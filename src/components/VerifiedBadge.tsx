import { ShieldCheck, UserCheck, CheckCircle2 } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface VerifiedBadgeProps {
  type: 'employer' | 'seeker' | 'freelancer'
  status?: 'APPROVED' | 'PENDING' | 'NEEDS_INFO' | 'REJECTED' | 'UNVERIFIED' | string | null
  className?: string
  showText?: boolean
  hideWhenUnverified?: boolean
}

export default function VerifiedBadge({
  type,
  status = 'APPROVED',
  className,
  showText = true,
  hideWhenUnverified = false,
}: VerifiedBadgeProps) {
  if (hideWhenUnverified && (!status || status === 'UNVERIFIED' || status === 'REJECTED' || status === 'NEEDS_INFO')) {
    return null
  }

  const configs = {
    employer: {
      icon: ShieldCheck,
      approvedText: 'Verified Business',
      pendingText: 'Business Pending',
      needsInfoText: 'Business Update',
      color: 'text-success bg-success/10 border-success/20',
      pendingColor: 'text-accent bg-accent/10 border-accent/20',
      needsInfoColor: 'text-secondary bg-secondary/10 border-secondary/20',
      description: 'Identity and business registration verified.',
      pendingDescription: 'Business verification is under review.',
      needsInfoDescription: 'More business verification detail is needed.',
    },
    seeker: {
      icon: UserCheck,
      approvedText: 'Verified Identity',
      pendingText: 'Identity Pending',
      needsInfoText: 'Identity Update',
      color: 'text-primary bg-primary/10 border-primary/20',
      pendingColor: 'text-accent bg-accent/10 border-accent/20',
      needsInfoColor: 'text-secondary bg-secondary/10 border-secondary/20',
      description: 'Phone and ID verification completed.',
      pendingDescription: 'Identity verification is under review.',
      needsInfoDescription: 'More identity verification detail is needed.',
    },
    freelancer: {
      icon: CheckCircle2,
      approvedText: 'Verified Pro',
      pendingText: 'Pro Pending',
      needsInfoText: 'Pro Update',
      color: 'text-secondary bg-secondary/10 border-secondary/20',
      pendingColor: 'text-accent bg-accent/10 border-accent/20',
      needsInfoColor: 'text-secondary bg-secondary/10 border-secondary/20',
      description: 'Skills and identity verified by our team.',
      pendingDescription: 'Professional verification is under review.',
      needsInfoDescription: 'More professional verification detail is needed.',
    }
  }

  const {
    icon: Icon,
    approvedText,
    pendingText,
    needsInfoText,
    color,
    pendingColor,
    needsInfoColor,
    description,
    pendingDescription,
    needsInfoDescription,
  } = configs[type]
  const isPending = status === 'PENDING'
  const isNeedsInfo = status === 'NEEDS_INFO'
  const text = isPending ? pendingText : isNeedsInfo ? needsInfoText : approvedText
  const tone = isPending ? pendingColor : isNeedsInfo ? needsInfoColor : color
  const tooltip = isPending ? pendingDescription : isNeedsInfo ? needsInfoDescription : description

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 cursor-default group relative",
        tone,
        className
      )}
      title={tooltip}
    >
      <Icon className="h-3.5 w-3.5" />
      {showText && <span>{text}</span>}
      
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-text-main text-white text-[9px] font-bold normal-case tracking-normal rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-50 text-center">
        {tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-text-main"></div>
      </div>
    </div>
  )
}
