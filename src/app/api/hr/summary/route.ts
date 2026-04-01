import { NextResponse } from 'next/server';
import { fetchPaylocityEmployeesExtended } from '@/lib/engines/data-bridge';

export async function GET() {
  try {
    const employees = await fetchPaylocityEmployeesExtended();

    // Department breakdown
    const byDept = new Map<string, number>();
    for (const e of employees) {
      const dept = e.department ?? 'Unknown';
      byDept.set(dept, (byDept.get(dept) ?? 0) + 1);
    }

    // Employee vs contractor
    const activeEmployees = employees.filter(
      (e) => (e.status ?? '').toLowerCase() !== 'terminated'
    );
    const contractors = activeEmployees.filter(
      (e) => (e.employeeType ?? '').toLowerCase() === 'contractor'
    );
    const fullTime = activeEmployees.filter(
      (e) => (e.employeeType ?? '').toLowerCase() !== 'contractor'
    );

    // New hires / terminations this month
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const newHires = employees.filter((e) => {
      if (!e.hireDate) return false;
      const d = new Date(e.hireDate);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const terminations = employees.filter((e) => {
      if (!e.terminationDate) return false;
      const d = new Date(e.terminationDate);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalEmployees: employees.length,
        activeCount: activeEmployees.length,
        contractorCount: contractors.length,
        fullTimeCount: fullTime.length,
        newHiresThisMonth: newHires.length,
        terminationsThisMonth: terminations.length,
        byDepartment: Array.from(byDept.entries())
          .map(([department, count]) => ({ department, count }))
          .sort((a, b) => b.count - a.count),
        employees: employees.slice(0, 100).map((e) => ({
          displayName: e.displayName,
          mail: e.mail,
          jobTitle: e.jobTitle,
          department: e.department,
          employeeType: e.employeeType,
          hireDate: e.hireDate,
          status: e.status,
          manager: e.manager,
          phone: e.phone,
        })),
        newHires: newHires.map((e) => ({
          displayName: e.displayName,
          department: e.department,
          jobTitle: e.jobTitle,
          hireDate: e.hireDate,
        })),
        recentTerminations: terminations.map((e) => ({
          displayName: e.displayName,
          department: e.department,
          terminationDate: e.terminationDate,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
