import { describe, expect, it } from 'vitest'
// The backend's table, imported directly across the workspace. It is pure
// TypeScript with no Mongoose or Node dependencies, so it loads cleanly here.
import {
  TRANSITIONS as BACKEND_TRANSITIONS,
  ActorRelation,
} from '../../../backend/src/domain/workflow/transitions'
import { RequestStatus, UserRole, type SupportRequest, type User } from '../types/domain'
import { TRANSITIONS, availableActions, canClaim, isTerminal, relationsOf } from './workflow'

/**
 * The frontend copy of the workflow exists so the UI never offers a control the
 * API would refuse. That is only true while the two tables agree — and nothing
 * else would notice them drifting apart, because both would still "work" and
 * the user would just get a surprise 422.
 *
 * This suite is the thing that notices.
 */
describe('the frontend workflow mirrors the backend', () => {
  it('has exactly the same set of transitions', () => {
    const backend = BACKEND_TRANSITIONS.map((t) => `${t.from}->${t.to}`).sort()
    const frontend = TRANSITIONS.map((t) => `${t.from}->${t.to}`).sort()

    expect(frontend).toEqual(backend)
  })

  it('permits each transition to exactly the same relations', () => {
    for (const backendRule of BACKEND_TRANSITIONS) {
      const mirrored = TRANSITIONS.find(
        (t) => t.from === backendRule.from && t.to === backendRule.to,
      )

      expect(mirrored, `${backendRule.from} -> ${backendRule.to} is missing`).toBeDefined()
      expect([...mirrored!.allowed].sort(), `${backendRule.from} -> ${backendRule.to}`).toEqual(
        [...backendRule.allowed].sort(),
      )
    }
  })

  it('agrees on which move is the reopen', () => {
    const backendReopen = BACKEND_TRANSITIONS.filter((t) => t.isReopen).map((t) => `${t.from}->${t.to}`)
    const frontendReopen = TRANSITIONS.filter((t) => t.isReopen).map((t) => `${t.from}->${t.to}`)

    expect(frontendReopen).toEqual(backendReopen)
  })

  it('uses the same relation names the backend does', () => {
    const backendRelations = new Set(Object.values(ActorRelation) as string[])
    const frontendRelations = new Set(TRANSITIONS.flatMap((t) => t.allowed as unknown as string[]))

    for (const relation of frontendRelations) {
      expect(backendRelations.has(relation)).toBe(true)
    }
  })

  it('gives every transition a human label, not a raw status', () => {
    for (const t of TRANSITIONS) {
      expect(t.label).toBeTruthy()
      expect(t.label).not.toBe(t.to)
    }
  })
})

const employee: User = {
  id: 'u-employee',
  email: 'e@x.com',
  name: 'Eve Employee',
  role: UserRole.EMPLOYEE,
  isActive: true,
  createdAt: '',
  updatedAt: '',
}
const agent: User = { ...employee, id: 'u-agent', name: 'Sam Agent', role: UserRole.AGENT }
const otherAgent: User = { ...agent, id: 'u-agent-2', name: 'Alex Agent' }
const manager: User = { ...employee, id: 'u-manager', name: 'Mo Manager', role: UserRole.MANAGER }

function requestWith(overrides: Partial<SupportRequest> = {}): SupportRequest {
  return {
    id: 'r1',
    reference: 'HD-000001',
    title: 'Laptop will not boot',
    description: 'It restarts in a loop.',
    category: 'IT',
    priority: 'HIGH',
    status: RequestStatus.NEW,
    requesterId: employee.id,
    assigneeId: null,
    history: [],
    resolvedAt: null,
    closedAt: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('relationsOf', () => {
  it('recognises the requester', () => {
    expect(relationsOf(requestWith(), employee).has('REQUESTER')).toBe(true)
  })

  it('recognises the assignee', () => {
    expect(relationsOf(requestWith({ assigneeId: agent.id }), agent).has('ASSIGNEE')).toBe(true)
  })

  it('gives a manager the manager relation on every request', () => {
    expect(relationsOf(requestWith(), manager).has('MANAGER')).toBe(true)
  })

  it('gives an unrelated agent nothing', () => {
    expect(relationsOf(requestWith({ assigneeId: agent.id }), otherAgent).size).toBe(0)
  })
})

describe('availableActions', () => {
  it('offers the requester nothing but withdrawing a NEW request', () => {
    const actions = availableActions(requestWith(), employee)

    expect(actions.map((a) => a.to)).toEqual([RequestStatus.CLOSED])
  })

  it('does not offer the requester a resolve', () => {
    const request = requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: agent.id })

    expect(availableActions(request, employee).map((a) => a.to)).not.toContain(RequestStatus.RESOLVED)
  })

  it('offers the assignee wait and resolve on work in progress', () => {
    const request = requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: agent.id })

    expect(availableActions(request, agent).map((a) => a.to).sort()).toEqual(
      [RequestStatus.RESOLVED, RequestStatus.WAITING].sort(),
    )
  })

  it('lets the requester resume a request that is waiting on them', () => {
    const request = requestWith({ status: RequestStatus.WAITING, assigneeId: agent.id })

    expect(availableActions(request, employee).map((a) => a.to)).toEqual([RequestStatus.IN_PROGRESS])
  })

  it('offers the requester a reopen once resolved, labelled as such', () => {
    const request = requestWith({ status: RequestStatus.RESOLVED, assigneeId: agent.id })
    const reopen = availableActions(request, employee).find((a) => a.isReopen)

    expect(reopen).toMatchObject({ to: RequestStatus.IN_PROGRESS, label: 'Reopen' })
  })

  it('offers nothing at all on a CLOSED request', () => {
    const request = requestWith({ status: RequestStatus.CLOSED, assigneeId: agent.id })

    expect(availableActions(request, manager)).toEqual([])
  })

  it('offers an unrelated agent nothing on work they do not own', () => {
    const request = requestWith({ status: RequestStatus.IN_PROGRESS, assigneeId: agent.id })

    expect(availableActions(request, otherAgent)).toEqual([])
  })
})

describe('isTerminal', () => {
  it('is true only for CLOSED', () => {
    const terminal = Object.values(RequestStatus).filter(isTerminal)

    expect(terminal).toEqual([RequestStatus.CLOSED])
  })
})

describe('canClaim', () => {
  it('lets an agent claim unassigned open work', () => {
    expect(canClaim(requestWith(), agent)).toBe(true)
  })

  it('refuses work someone already owns', () => {
    expect(canClaim(requestWith({ assigneeId: otherAgent.id }), agent)).toBe(false)
  })

  it('refuses a closed request', () => {
    expect(canClaim(requestWith({ status: RequestStatus.CLOSED }), agent)).toBe(false)
  })

  it('refuses an employee, who has no queue', () => {
    expect(canClaim(requestWith(), employee)).toBe(false)
  })
})
