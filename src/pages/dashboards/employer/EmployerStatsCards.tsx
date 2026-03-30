import { Briefcase, Users, MessageSquare } from 'lucide-react'

type Props = {
  jobCount: number
  totalApplicants: number
  unreadMessages: number
  pendingPaymentActions: number
}

export default function EmployerStatsCards({ jobCount, totalApplicants, unreadMessages, pendingPaymentActions }: Props) {
  return (
    <div className="metric-rail mb-10 md:mb-14">
      <div className="metric-card metric-card--solid">
        <div className="flex justify-between items-start mb-6">
          <div className="h-14 w-14 text-primary bg-surface-alt rounded-2xl flex items-center justify-center group-hover:bg-primary/5 transition-colors">
            <Briefcase className="h-7 w-7" />
          </div>
          <span className="badge bg-success/10 text-success border-none text-[9px] uppercase tracking-widest">Live</span>
        </div>
        <p className="text-4xl font-black text-text-main leading-none mb-2">{jobCount}</p>
        <p className="text-[10px] font-black text-text-light uppercase tracking-[0.2em]">Posted Roles</p>
      </div>
      <div className="metric-card">
        <div className="flex justify-between items-start mb-6">
          <div className="h-14 w-14 text-secondary bg-surface-alt rounded-2xl flex items-center justify-center group-hover:bg-secondary/5 transition-colors">
            <Users className="h-7 w-7" />
          </div>
          <span className="badge bg-secondary text-white border-none text-[9px] uppercase tracking-widest">Applicants</span>
        </div>
        <p className="text-4xl font-black text-text-main leading-none mb-2">{totalApplicants}</p>
        <p className="text-[10px] font-black text-text-light uppercase tracking-[0.2em]">Visible Candidates</p>
      </div>
      <div className="metric-card">
        <div className="flex justify-between items-start mb-6">
          <div className="h-14 w-14 text-accent bg-surface-alt rounded-2xl flex items-center justify-center group-hover:bg-accent/5 transition-colors">
            <MessageSquare className="h-7 w-7" />
          </div>
          <span className="badge bg-primary text-white border-none text-[9px] uppercase tracking-widest">Inbox</span>
        </div>
        <p className="text-4xl font-black text-text-main leading-none mb-2">{unreadMessages}</p>
        <p className="text-[10px] font-black text-text-light uppercase tracking-[0.2em]">Unread Messages</p>
      </div>
    </div>
  )
}
