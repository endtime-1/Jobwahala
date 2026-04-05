import { useState, useEffect } from 'react'
import { Landmark, Wallet, Plus, CheckCircle2, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
import { apiGetBanks, apiSavePayoutAccount, apiGetPayoutAccount } from '../lib/api'

interface Bank {
  id: number
  name: string
  code: string
  type: string
}

interface PayoutAccount {
  bankName: string
  accountNumber: string
  accountName: string
  type: string
}

export default function PayoutPanel() {
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount | null>(null)
  const [banks, setBanks] = useState<Bank[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    bankCode: '',
    accountNumber: '',
    accountName: '',
    type: 'mobile_money'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [accRes, banksRes] = await Promise.all([
        apiGetPayoutAccount(),
        apiGetBanks()
      ])
      setPayoutAccount(accRes.payoutAccount)
      setBanks(banksRes.banks || [])
    } catch (err) {
      console.error('Failed to fetch payout data', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      const selectedBank = banks.find(b => b.code === formData.bankCode)
      const res = await apiSavePayoutAccount({
        ...formData,
        bankName: selectedBank?.name || ''
      })
      setPayoutAccount(res.payoutAccount)
      setShowForm(false)
    } catch (err: any) {
      setError(err.message || 'Failed to save payout account')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="dashboard-panel p-6 flex justify-center items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="dashboard-panel p-5 sm:p-6 overflow-hidden relative group/payout">
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-black text-xs uppercase tracking-[0.2em] text-primary flex items-center gap-3">
            <Wallet className="h-4 w-4" /> Payout Settings
          </h2>
          {payoutAccount && !showForm && (
            <button 
              onClick={() => {
                setFormData({
                  bankCode: '',
                  accountNumber: payoutAccount.accountNumber,
                  accountName: payoutAccount.accountName,
                  type: payoutAccount.type
                })
                setShowForm(true)
              }}
              className="text-[10px] font-black uppercase tracking-widest text-text-light hover:text-primary transition-colors"
            >
              Update
            </button>
          )}
        </div>

        {showForm ? (
          <form onSubmit={handleSave} className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            {error && (
              <div className="rounded-xl border border-error/10 bg-error/5 p-3 text-[11px] font-bold text-error flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </div>
            )}
            
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-light block mb-2">Account Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, type: 'mobile_money' }))}
                  className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.type === 'mobile_money' ? 'bg-primary text-white border-primary' : 'bg-white text-text-muted border-surface-border'}`}
                >
                  Mobile Money
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, type: 'bank' }))}
                  className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.type === 'bank' ? 'bg-primary text-white border-primary' : 'bg-white text-text-muted border-surface-border'}`}
                >
                  Bank Transfer
                </button>
              </div>
            </div>

            <div className="relative">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-light block mb-2">Select Provider</label>
              <select 
                value={formData.bankCode}
                onChange={(e) => setFormData(f => ({ ...f, bankCode: e.target.value }))}
                className="w-full h-11 rounded-xl border border-surface-border px-4 text-xs font-bold appearance-none bg-white cursor-pointer"
                required
              >
                <option value="">Choose a bank or MoMo...</option>
                {banks.map(bank => (
                  <option key={bank.code} value={bank.code}>{bank.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 bottom-3.5 h-4 w-4 text-text-light pointer-events-none" />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-light block mb-2">Account Number / Phone</label>
              <input 
                type="text"
                placeholder="e.g. 0244000000"
                value={formData.accountNumber}
                onChange={(e) => setFormData(f => ({ ...f, accountNumber: e.target.value }))}
                className="w-full h-11 rounded-xl border border-surface-border px-4 text-xs font-bold"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-light block mb-2">Account Name</label>
              <input 
                type="text"
                placeholder="Full Name as on Account"
                value={formData.accountName}
                onChange={(e) => setFormData(f => ({ ...f, accountName: e.target.value }))}
                className="w-full h-11 rounded-xl border border-surface-border px-4 text-xs font-bold"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-surface-border bg-white text-text-muted"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSaving}
                className="flex-[2] bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Details'}
              </button>
            </div>
          </form>
        ) : payoutAccount ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-success/5 border border-success/10">
              <div className="h-10 w-10 bg-success/10 rounded-xl flex items-center justify-center text-success">
                {payoutAccount.type === 'mobile_money' ? <Plus className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-success flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> Linked & Active
                </p>
                <p className="text-sm font-black text-text-main mt-0.5">{payoutAccount.bankName}</p>
              </div>
            </div>
            <div className="px-1 text-[11px] font-bold text-text-muted leading-relaxed">
              <p>Escrow funds will be automatically transferred to <span className="text-text-main">{payoutAccount.accountNumber}</span> ({payoutAccount.accountName}) upon milestone completion.</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="inline-flex h-14 w-14 bg-surface-alt/50 rounded-2xl items-center justify-center text-text-light mb-4">
              <Landmark className="h-7 w-7" />
            </div>
            <p className="text-xs font-bold text-text-muted mb-6 max-w-[200px] mx-auto leading-relaxed"> Link your bank or mobile money account to receive payments.</p>
            <button 
              onClick={() => setShowForm(true)}
              className="btn btn-primary btn-sm w-full font-black uppercase tracking-widest text-[10px]"
            >
              Link Payout Account
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
