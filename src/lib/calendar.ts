/**
 * Microsoft Graph Calendar Integration
 *
 * Creates real calendar events with Teams meeting links.
 * Requires Azure AD app permission: Calendars.ReadWrite
 *
 * Setup steps:
 * 1. Azure Portal → App Registrations → 5e67b1da-9335-477b-a760-ed12d57bd17c
 * 2. API Permissions → Add → Microsoft Graph → Delegated → Calendars.ReadWrite
 * 3. Also add: OnlineMeetings.ReadWrite (for Teams links)
 * 4. Grant admin consent
 */

import { gatewayFetch } from '@/lib/gateway';

interface CalendarEvent {
  subject: string;
  start: string;          // ISO datetime
  end: string;            // ISO datetime
  attendees: string[];    // email addresses
  body?: string;          // HTML body content
  isOnlineMeeting: boolean;
  location?: string;
  organizer?: string;     // organizer email (logged-in user)
}

interface CalendarResult {
  success: boolean;
  eventId?: string;
  meetingLink?: string;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Create a calendar event with optional Teams meeting link
 */
export async function createCalendarEvent(event: CalendarEvent): Promise<CalendarResult> {
  try {
    const graphPayload = {
      subject: event.subject,
      start: {
        dateTime: event.start,
        timeZone: 'Central Standard Time',
      },
      end: {
        dateTime: event.end,
        timeZone: 'Central Standard Time',
      },
      attendees: event.attendees.map(email => ({
        emailAddress: { address: email },
        type: 'required',
      })),
      body: {
        contentType: 'HTML',
        content: event.body ?? `<p>Meeting created by Delta Intelligence</p>`,
      },
      isOnlineMeeting: event.isOnlineMeeting,
      onlineMeetingProvider: event.isOnlineMeeting ? 'teamsForBusiness' : undefined,
      location: event.location ? { displayName: event.location } : undefined,
    };

    // Call Microsoft Graph via the gateway write endpoint
    // Gateway uses client_credentials flow, so we must use /users/{email}/events
    // (not /me/events which requires delegated auth)
    // Organizer is the logged-in user (passed via organizer field), NOT the first attendee
    const organizerEmail = event.organizer ?? 'etheiss@delta360.energy';
    const result = await gatewayFetch('/microsoft/write', 'admin', {
      method: 'POST',
      body: {
        path: `/users/${organizerEmail}/events`,
        body: graphPayload,
      },
    });

    const data = result as Record<string, unknown>;

    if (data.success === false) {
      return {
        success: false,
        error: String(data.error ?? 'Failed to create calendar event'),
        details: data,
      };
    }

    // Extract meeting link from response
    const onlineMeeting = data.onlineMeeting as Record<string, unknown> | undefined;
    const meetingLink = onlineMeeting?.joinUrl as string | undefined;

    return {
      success: true,
      eventId: data.id as string | undefined,
      meetingLink,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Calendar API call failed',
    };
  }
}

/**
 * Look up a user's email by name via Microsoft Graph
 */
export async function findUserEmail(name: string): Promise<string | null> {
  try {
    const result = await gatewayFetch('/microsoft/users', 'admin');
    const data = result as Record<string, unknown>;
    const users = (data.value ?? data.data ?? []) as Array<Record<string, unknown>>;

    // Fuzzy match on display name
    const lower = name.toLowerCase();
    const match = users.find(u => {
      const displayName = String(u.displayName ?? '').toLowerCase();
      const mail = String(u.mail ?? '').toLowerCase();
      return displayName.includes(lower) || mail.includes(lower);
    });

    return match ? String(match.mail ?? match.userPrincipalName ?? '') : null;
  } catch {
    return null;
  }
}

/**
 * Parse natural language time into ISO datetime
 */
export function parseTime(input: string, referenceDate?: Date): { start: string; end: string } | null {
  const now = referenceDate ?? new Date();
  const lower = input.toLowerCase();

  // Extract time (2 PM, 2:00 PM, 14:00)
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|cst|est|pst)?/i);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2] ?? '0');
  const ampm = (timeMatch[3] ?? '').toLowerCase();

  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  // Extract duration
  let durationMinutes = 60; // default 1 hour
  const durMatch = lower.match(/(\d+)\s*(?:min|minute)/i);
  if (durMatch) durationMinutes = parseInt(durMatch[1]);
  if (/30\s*min/i.test(lower)) durationMinutes = 30;
  if (/1\.?5\s*hour/i.test(lower)) durationMinutes = 90;
  if (/(?:^|[^.\d])1\s*hour/i.test(lower)) durationMinutes = 60;
  if (/2\s*hour/i.test(lower)) durationMinutes = 120;

  // Extract date
  let date = new Date(now);

  // "tomorrow"
  if (/tomorrow/i.test(lower)) {
    date.setDate(date.getDate() + 1);
  }
  // "today"
  else if (/today/i.test(lower)) {
    // keep current date
  }
  // "next Monday", "next Friday", etc.
  else if (/next\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(lower)) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const target = days.indexOf(lower.match(/next\s*(\w+)/i)?.[1]?.toLowerCase() ?? '');
    if (target >= 0) {
      const current = date.getDay();
      const diff = ((target - current + 7) % 7) || 7;
      date.setDate(date.getDate() + diff);
    }
  }
  // "this Monday", "this Friday" (current week)
  else if (/this\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(lower)) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const target = days.indexOf(lower.match(/this\s*(\w+)/i)?.[1]?.toLowerCase() ?? '');
    if (target >= 0) {
      const current = date.getDay();
      const diff = (target - current + 7) % 7;
      date.setDate(date.getDate() + diff);
    }
  }
  // "April 5", "March 15", "Jan 3" — month name + day
  else if (/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?\b/i.test(lower)) {
    const monthNames: Record<string, number> = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
      may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
      sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
    };
    const dateMatch = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?\b/i);
    if (dateMatch) {
      const month = monthNames[dateMatch[1].toLowerCase()];
      const day = parseInt(dateMatch[2]);
      const year = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
      if (month !== undefined) {
        date = new Date(year, month, day);
      }
    }
  }
  // "4/5", "4/5/2026" — numeric m/d or m/d/yyyy
  else if (/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.test(lower)) {
    const numMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (numMatch) {
      const month = parseInt(numMatch[1]) - 1;
      const day = parseInt(numMatch[2]);
      let year = numMatch[3] ? parseInt(numMatch[3]) : now.getFullYear();
      if (year < 100) year += 2000;
      date = new Date(year, month, day);
    }
  }
  // "2026-04-05" — ISO format
  else if (/\b(\d{4})-(\d{2})-(\d{2})\b/.test(lower)) {
    const isoMatch = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (isoMatch) {
      date = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }
  }
  // else: today (default)

  const start = new Date(date);
  start.setHours(hours, minutes, 0, 0);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMinutes);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Known Delta360 employees for quick lookup
 */
export const KNOWN_EMPLOYEES: Record<string, string> = {
  // Leadership
  'evan': 'etheiss@delta360.energy',
  'evan theiss': 'etheiss@delta360.energy',
  'adam': 'avegas@delta360.energy',
  'adam vegas': 'avegas@delta360.energy',
  'courtney': 'comaples@delta360.energy',
  'courtney maples': 'comaples@delta360.energy',
  // Finance / Accounting
  'erin': 'fuelpayables@delta360.energy',
  'erin smith': 'fuelpayables@delta360.energy',
  'helen': 'achpayments@delta360.energy',
  'helen burns': 'achpayments@delta360.energy',
  'barbara': 'blasseigne@delta360.energy',
  'barbara lasseigne': 'blasseigne@delta360.energy',
  // Sales — Oil & Gas
  'anna': 'asnodgrass@delta360.energy',
  'anna snodgrass': 'asnodgrass@delta360.energy',
  'ashlee': 'ahey@delta360.energy',
  'ashlee hey': 'ahey@delta360.energy',
  'adriana': 'ahernandez@delta360.energy',
  'adriana hernandez': 'ahernandez@delta360.energy',
  // Sales — Commercial
  'ashley': 'ahadwin@delta360.energy',
  'ashley hadwin': 'ahadwin@delta360.energy',
  'barry': 'biseminger@delta360.energy',
  'barry iseminger': 'biseminger@delta360.energy',
  'brandon': 'bthornton@delta360.energy',
  'brandon thornton': 'bthornton@delta360.energy',
  'brian m': 'bmccaskill@delta360.energy',
  'brian mccaskill': 'bmccaskill@delta360.energy',
  'alexis': 'adeaton@delta360.energy',
  'alexis deaton': 'adeaton@delta360.energy',
  'carson': 'cgreer@delta360.energy',
  'carson greer': 'cgreer@delta360.energy',
  'chad': 'csheppard@delta360.energy',
  'chad sheppard': 'csheppard@delta360.energy',
  'cody': 'cmclelland@delta360.energy',
  'cody mclelland': 'cmclelland@delta360.energy',
  'bubba': 'bstrack@delta360.energy',
  'bubba strack': 'bstrack@delta360.energy',
  // Operations
  'abby': 'amarks@delta360.energy',
  'abby marks': 'amarks@delta360.energy',
  'dana': 'dbarron@delta360.energy',
  'dana barron': 'dbarron@delta360.energy',
  'brian p': 'bpourciaux@delta360.energy',
  'brian pourciaux': 'bpourciaux@delta360.energy',
  'taylor': 'tveazey@delta360.energy',
  'taylor veazey': 'tveazey@delta360.energy',
  'blake': 'bmcneil@delta360.energy',
  'blake mcneil': 'bmcneil@delta360.energy',
};

export function resolveEmail(nameOrEmail: string): string {
  if (nameOrEmail.includes('@')) return nameOrEmail;
  const lower = nameOrEmail.toLowerCase().trim();
  return KNOWN_EMPLOYEES[lower] ?? `${lower.replace(/\s+/g, '.')}@delta360.energy`;
}
