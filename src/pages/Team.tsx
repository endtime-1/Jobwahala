import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, UserPlus } from 'lucide-react'
import SEO from '../components/SEO'
import { apiGetTeam, apiInviteTeamMember, apiRemoveTeamMember } from '../lib/api'
import { formatShortDate } from '../lib/display'
import { getErrorMessage } from '../lib/errors'

type Member = { id: string; email: string; status: 'INVITED' | 'ACTIVE' | 'SUSPENDED'; invitedAt: string; joinedAt: string | null }
type Team = { limit: number; used: number; planName: string; members: Member[] }

const STATUS: Record<Member['status'], string> = { INVITED: 'Invited', ACTIVE: 'Active', SUSPENDED: 'Paused: over your plan limit' }

/** The people who work on this company's jobs and applicants. The seat limit comes from the plan and is checked on the server. */
export default function Team() {
  const [team, setTeam] = useState<Team | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      setTeam((await apiGetTeam()) as Team)
    } catch (err) {
      setError(getErrorMessage(err, 'We could not load your team.'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const invite = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy('invite')
    try {
      await apiInviteTeamMember(email.trim())
      setNotice(`We sent an invitation to ${email.trim()}.`)
      setEmail('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'We could not send that invitation.'))
    } finally {
      setBusy('')
    }
  }

  const remove = async (member: Member) => {
    if (!window.confirm(`Remove ${member.email} from your team? They lose access to your jobs and applicants.`)) return
    setError('')
    setNotice('')
    setBusy(member.id)
    try {
      await apiRemoveTeamMember(member.id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'We could not remove that person.'))
    } finally {
      setBusy('')
    }
  }

  const full = team ? team.used >= team.limit : false

  return (
    <div className="container max-w-3xl pb-24 pt-28">
      <SEO title="Your team" noindex />
      <header className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-text-main">Your team</h1>
        <p className="mt-2 text-base font-medium text-text-muted">
          Team members can post jobs and review applicants for your company. They cannot see your billing or change your plan.
        </p>
      </header>

      {error ? (
        <p role="alert" className="mb-4 rounded-2xl border border-error/10 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mb-4 rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-semibold text-text-main">
          {notice}
        </p>
      ) : null}

      {team ? (
        <>
          <p className="mb-4 text-sm font-bold text-text-main">
            Seats used: {team.used} of {team.limit} on {team.planName}. You have the first seat.
          </p>

          <form onSubmit={(event) => void invite(event)} className="mb-8 flex flex-col gap-3 rounded-2xl border border-surface-border bg-white p-5 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm font-bold text-text-main">
              Email of the person to invite
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={full} className="mt-1 w-full" placeholder="colleague@company.com" />
            </label>
            <button type="submit" disabled={full || busy === 'invite'} className="btn btn-primary btn-sm px-5 disabled:opacity-60">
              <UserPlus className="h-4 w-4" aria-hidden /> {busy === 'invite' ? 'Sending...' : 'Send invitation'}
            </button>
          </form>
          {full ? (
            <p className="-mt-5 mb-8 text-sm font-semibold text-text-muted">
              Your plan has no more seats.{' '}
              <Link to="/plans" className="font-bold text-primary hover:underline">
                See plans
              </Link>{' '}
              for more team members.
            </p>
          ) : null}

          {team.members.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-surface-border bg-white p-8 text-center text-sm font-semibold text-text-muted">No team members yet.</p>
          ) : (
            <ul className="divide-y divide-surface-border/60 rounded-2xl border border-surface-border bg-white">
              {team.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-text-main">{member.email}</p>
                    <p className="text-xs font-semibold text-text-muted">
                      {STATUS[member.status]} · invited {formatShortDate(member.invitedAt)}
                    </p>
                  </div>
                  <button type="button" disabled={busy === member.id} onClick={() => void remove(member)} aria-label={`Remove ${member.email}`} className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-error hover:underline disabled:opacity-60">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  )
}
