/**
 * Unified Notification Service
 *
 * Routes notifications to the configured channel: email, SMS, Teams, or Slack.
 * Falls back gracefully when integrations are not configured.
 */

import { getIntegrationConfig } from '@/lib/integrations';
import { gatewayFetch } from '@/lib/gateway';

// ── Types ────────────────────────────────────────────────────

export interface NotifyConfig {
  channel: 'email' | 'sms' | 'teams' | 'slack';
  to: string | string[];
  subject?: string;
  body: string;
  attachments?: Array<{ name: string; content: Buffer }>;
}

export interface NotifyResult {
  success: boolean;
  error?: string;
}

// ── Channel Handlers ─────────────────────────────────────────

async function sendEmail(config: NotifyConfig): Promise<NotifyResult> {
  const recipients = Array.isArray(config.to) ? config.to : [config.to];

  // Try Resend first
  const resendConfig = getIntegrationConfig('resend');
  if (resendConfig?.values.apiKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendConfig.values.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Delta Intelligence <notifications@delta360.energy>',
          to: recipients,
          subject: config.subject ?? 'Delta Intelligence Notification',
          text: config.body,
        }),
      });

      if (resp.ok) {
        return { success: true };
      }

      const errData = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      // Fall through to Graph
      console.warn('[notifications] Resend failed, trying Graph:', errData);
    } catch (err) {
      console.warn('[notifications] Resend error, trying Graph:', err);
    }
  }

  // Fallback: Microsoft Graph via gateway
  try {
    const result = await gatewayFetch('/microsoft/query', 'admin', {
      method: 'POST',
      body: {
        endpoint: '/me/sendMail',
        method: 'POST',
        body: {
          message: {
            subject: config.subject ?? 'Delta Intelligence Notification',
            body: { contentType: 'Text', content: config.body },
            toRecipients: recipients.map((email) => ({
              emailAddress: { address: email },
            })),
          },
        },
      },
    });

    if (result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: `Graph send failed: ${result.error ?? 'unknown'}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Email delivery failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
}

async function sendSms(config: NotifyConfig): Promise<NotifyResult> {
  const twilioConfig = getIntegrationConfig('twilio');
  if (!twilioConfig?.values.accountSid || !twilioConfig?.values.authToken) {
    return { success: false, error: 'Twilio not configured' };
  }

  const { accountSid, authToken, fromNumber } = twilioConfig.values;
  const recipients = Array.isArray(config.to) ? config.to : [config.to];

  try {
    for (const to of recipients) {
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: to,
            From: fromNumber ?? '',
            Body: config.body.slice(0, 1600),
          }).toString(),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        return {
          success: false,
          error: `Twilio error (${resp.status}): ${errText.slice(0, 200)}`,
        };
      }
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `SMS delivery failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
}

async function sendTeams(config: NotifyConfig): Promise<NotifyResult> {
  const teamsConfig = getIntegrationConfig('teams');
  if (!teamsConfig?.values.channelWebhookUrl) {
    return { success: false, error: 'Teams webhook not configured' };
  }

  try {
    const resp = await fetch(teamsConfig.values.channelWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: 'FF5C00',
        summary: config.subject ?? 'Delta Intelligence',
        sections: [
          {
            activityTitle: config.subject ?? 'Notification',
            text: config.body,
          },
        ],
      }),
    });

    if (resp.ok) {
      return { success: true };
    }

    return {
      success: false,
      error: `Teams webhook returned ${resp.status}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Teams delivery failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
}

async function sendSlack(config: NotifyConfig): Promise<NotifyResult> {
  const slackConfig = getIntegrationConfig('slack');
  if (!slackConfig?.values.webhookUrl) {
    return { success: false, error: 'Slack webhook not configured' };
  }

  try {
    const resp = await fetch(slackConfig.values.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: config.subject
          ? `*${config.subject}*\n${config.body}`
          : config.body,
      }),
    });

    if (resp.ok) {
      return { success: true };
    }

    return {
      success: false,
      error: `Slack webhook returned ${resp.status}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Slack delivery failed: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
}

// ── Main Router ──────────────────────────────────────────────

export async function notify(config: NotifyConfig): Promise<NotifyResult> {
  switch (config.channel) {
    case 'email':
      return sendEmail(config);
    case 'sms':
      return sendSms(config);
    case 'teams':
      return sendTeams(config);
    case 'slack':
      return sendSlack(config);
    default:
      return { success: false, error: `Unknown channel: ${config.channel}` };
  }
}
