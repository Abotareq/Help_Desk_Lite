import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { RequestPriority, RequestStatus } from '../../types/domain'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { FormField } from './FormField'
import { Input } from './Input'
import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'

/**
 * These are used on every screen, so a change here changes all of them at once.
 * The tests pin behaviour rather than styling — what a user or a screen reader
 * gets, not which classes produce it.
 */
describe('Button', () => {
  it('does not submit a form unless asked to', () => {
    renderWithProviders(<Button>Press</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('can opt into submitting', () => {
    renderWithProviders(<Button type="submit">Send</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('is disabled and shows a spinner while loading', () => {
    renderWithProviders(<Button loading>Save</Button>)

    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('cannot be clicked while loading', async () => {
    const onClick = vi.fn()
    renderWithProviders(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )

    await userEvent.click(screen.getByRole('button'))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('still calls its handler when idle', async () => {
    const onClick = vi.fn()
    renderWithProviders(<Button onClick={onClick}>Save</Button>)

    await userEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('StatusBadge', () => {
  it.each([
    [RequestStatus.NEW, 'New'],
    [RequestStatus.IN_PROGRESS, 'In progress'],
    [RequestStatus.WAITING, 'Waiting'],
    [RequestStatus.RESOLVED, 'Resolved'],
    [RequestStatus.CLOSED, 'Closed'],
  ])('renders %s as %s rather than the raw enum', (status, label) => {
    renderWithProviders(<StatusBadge status={status} />)

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('hides the colour dot from assistive technology, which cannot use it', () => {
    const { container } = renderWithProviders(<StatusBadge status={RequestStatus.NEW} />)

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    // The label carries the meaning, so colour is never the only signal.
    expect(screen.getByText('New')).toBeInTheDocument()
  })
})

describe('PriorityBadge', () => {
  it.each([
    [RequestPriority.HIGH, 'High'],
    [RequestPriority.MEDIUM, 'Medium'],
    [RequestPriority.LOW, 'Low'],
  ])('renders %s as %s', (priority, label) => {
    renderWithProviders(<PriorityBadge priority={priority} />)

    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('Avatar', () => {
  it('uses first and last initials', () => {
    renderWithProviders(<Avatar name="Eve Employee" />)

    expect(screen.getByText('EE')).toBeInTheDocument()
  })

  it('handles a single name', () => {
    renderWithProviders(<Avatar name="Prince" />)

    expect(screen.getByText('PR')).toBeInTheDocument()
  })

  it('does not fall over on an empty name', () => {
    renderWithProviders(<Avatar name="   " />)

    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('gives the same person the same colour on every screen', () => {
    const { container: a } = renderWithProviders(<Avatar name="Sam Agent" />)
    const { container: b } = renderWithProviders(<Avatar name="Sam Agent" />)

    expect(a.firstElementChild?.className).toBe(b.firstElementChild?.className)
  })

  it('exposes the full name, since initials alone are ambiguous', () => {
    renderWithProviders(<Avatar name="Eve Employee" />)

    expect(screen.getByTitle('Eve Employee')).toBeInTheDocument()
  })
})

describe('FormField', () => {
  it('associates its label with the input', () => {
    renderWithProviders(
      <FormField label="Email" htmlFor="email">
        <Input id="email" />
      </FormField>,
    )

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows the hint when there is no error', () => {
    renderWithProviders(
      <FormField label="Email" htmlFor="email" hint="We never share it">
        <Input id="email" />
      </FormField>,
    )

    expect(screen.getByText('We never share it')).toBeInTheDocument()
  })

  // An error is more urgent than advice, and showing both crowds the field.
  it('replaces the hint with the error once there is one', () => {
    renderWithProviders(
      <FormField label="Email" htmlFor="email" hint="We never share it" error="Required">
        <Input id="email" />
      </FormField>,
    )

    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument()
  })
})

describe('Input', () => {
  it('marks itself invalid for assistive technology', () => {
    renderWithProviders(<Input aria-label="Title" invalid />)

    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
  })

  it('says nothing when it is valid, rather than aria-invalid="false"', () => {
    renderWithProviders(<Input aria-label="Title" />)

    expect(screen.getByLabelText('Title')).not.toHaveAttribute('aria-invalid')
  })
})
