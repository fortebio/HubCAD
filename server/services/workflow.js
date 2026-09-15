import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { checklistResults } from '../db/schema.js';
import { DRAWING_SECTIONS, DFM_SECTIONS, RELEASE_SECTIONS } from './pdf/checklistSections.js';

export const WORKFLOW_TRANSITIONS = {
  draft: ['in_review'],
  in_review: ['approved', 'draft'],
  approved: ['released', 'draft'],
  released: ['obsolete'],
  obsolete: [],
};

const REQUIRED_ROLE = {
  'draft:in_review': ['designer', 'reviewer', 'manager'],
  'in_review:approved': ['reviewer', 'manager'],
  // Sending work back for rework must be an auditable reviewer decision;
  // designers cannot silently move an approved document back to draft.
  'in_review:draft': ['reviewer', 'manager'],
  'approved:released': ['manager'],
  'approved:draft': ['reviewer', 'manager'],
  'released:obsolete': ['manager'],
};

const GATE_BY_STATUS = {
  in_review: { type: 'drawing', label: 'Drawing checklist / Checklist bản vẽ', sections: DRAWING_SECTIONS },
  approved: { type: 'dfm', label: 'DFM / DFA review / Đánh giá DFM / DFA', sections: DFM_SECTIONS },
  released: { type: 'release', label: 'Release checklist / Checklist phát hành', sections: RELEASE_SECTIONS },
};

function expectedItemCount(sections) {
  return sections.reduce((sum, section) => sum + section.items.length, 0);
}

function parseResults(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function latestChecklist(documentId, type) {
  return db
    .select()
    .from(checklistResults)
    .where(and(eq(checklistResults.documentId, documentId), eq(checklistResults.checklistType, type)))
    .orderBy(desc(checklistResults.checkedAt), desc(checklistResults.id))
    .get();
}

function checklistRequirement(documentId, gate) {
  const latest = latestChecklist(documentId, gate.type);
  const expected = expectedItemCount(gate.sections);
  const values = Object.values(parseResults(latest?.results));
  const passed = !!latest && values.length === expected && values.every((value) => value === 'ok');

  return {
    key: `checklist:${gate.type}`,
    label: gate.label,
    passed,
    detail: latest
      ? passed
        ? `Passed ${expected}/${expected} items`
        : `${values.filter((value) => value === 'ok').length}/${expected} items OK — save a complete all-OK checklist`
      : 'Not completed yet / Chưa hoàn tất',
    href: gate.type === 'drawing' ? '/checklist' : gate.type === 'dfm' ? '/dfm' : '/release',
  };
}

export function getWorkflowReadiness(document, user) {
  const transitions = (WORKFLOW_TRANSITIONS[document.status] || []).map((to) => {
    const requirements = [];
    const allowedRoles = REQUIRED_ROLE[`${document.status}:${to}`] || [];
    if (!user) {
      requirements.push({ key: 'auth', label: 'Sign in / Đăng nhập', passed: false, detail: 'Sign in is required' });
    } else if (allowedRoles.length && !allowedRoles.includes(user.role)) {
      requirements.push({
        key: 'role',
        label: 'Required role / Vai trò yêu cầu',
        passed: false,
        detail: `Requires ${allowedRoles.join(' or ')}`,
      });
    }
    const gate = GATE_BY_STATUS[to];
    if (gate) requirements.push(checklistRequirement(document.id, gate));
    return { to, ready: requirements.every((requirement) => requirement.passed), requirements };
  });

  return { documentId: document.id, currentStatus: document.status, transitions };
}

export function assertWorkflowTransition(document, nextStatus, user) {
  const readiness = getWorkflowReadiness(document, user);
  const transition = readiness.transitions.find((item) => item.to === nextStatus);
  if (!transition) return { ok: false, status: 409, error: `Cannot transition from ${document.status} to ${nextStatus}` };
  if (!transition.ready) {
    const blockers = transition.requirements.filter((requirement) => !requirement.passed);
    return { ok: false, status: 422, error: blockers.map((blocker) => blocker.label).join('; '), blockers, readiness };
  }
  return { ok: true, readiness };
}
