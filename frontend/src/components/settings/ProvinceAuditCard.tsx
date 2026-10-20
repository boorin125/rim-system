'use client'

// Settings › Organization — province values that couldn't be matched automatically to one of the
// 77 canonical provinces (the backend fixes recognisable spellings on every start). Admin maps each one.
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { MapPin, RefreshCw, CheckCircle2 } from 'lucide-react'
import ProvinceSelect from '@/components/ProvinceSelect'

interface UnknownProvince {
  value: string
  stores: number
  userAddress: number
  responsible: number
}

export default function ProvinceAuditCard() {
  const [items, setItems] = useState<UnknownProvince[] | null>(null)
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/provinces/audit`, { headers: headers() })
      setItems(res.data || [])
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => { load() }, [load])

  const normalize = async () => {
    setBusy('__all')
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/provinces/normalize`, {}, { headers: headers() })
      const { stores, userAddress, responsible, unknown } = res.data
      toast.success(`แก้ไขอัตโนมัติ: ร้าน ${stores}, ที่อยู่ผู้ใช้ ${userAddress}, จังหวัดที่ช่างดูแล ${responsible}`)
      setItems(unknown || [])
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'ตรวจสอบไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  const remap = async (from: string) => {
    const to = targets[from]
    if (!to) return
    setBusy(from)
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/provinces/remap`, { from, to }, { headers: headers() })
      toast.success(`เปลี่ยน "${from}" → ${to} แล้ว (ร้าน ${res.data.stores}, ผู้ใช้ ${res.data.userAddress + res.data.responsible})`)
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-400" /> ตรวจสอบชื่อจังหวัด
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            ระบบแก้ชื่อจังหวัดที่สะกดต่างกันให้เป็นชื่อภาษาอังกฤษมาตรฐานอัตโนมัติ (ร้านค้า, ที่อยู่ผู้ใช้, จังหวัดที่ช่างดูแล) —
            รายการด้านล่างคือค่าที่ระบบจับคู่เองไม่ได้ กรุณาเลือกจังหวัดที่ถูกต้อง
          </p>
        </div>
        <button
          type="button"
          onClick={normalize}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-slate-600 text-gray-300 hover:text-white hover:bg-slate-700/50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${busy === '__all' ? 'animate-spin' : ''}`} /> ตรวจสอบอีกครั้ง
        </button>
      </div>

      {items === null ? (
        <p className="text-sm text-slate-500">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-green-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> ชื่อจังหวัดทั้งหมดถูกต้องตามรายการ 77 จังหวัด
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.value} className="flex flex-col sm:flex-row sm:items-center gap-2 border border-slate-700/60 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-yellow-300 font-medium break-all">&quot;{it.value}&quot;</p>
                <p className="text-xs text-slate-500">
                  ร้าน {it.stores} · ที่อยู่ผู้ใช้ {it.userAddress} · จังหวัดที่ช่างดูแล {it.responsible}
                </p>
              </div>
              <div className="sm:w-72">
                <ProvinceSelect
                  value={targets[it.value] || ''}
                  onChange={(v) => setTargets((t) => ({ ...t, [it.value]: v }))}
                  className="px-3 py-2 text-sm"
                  placeholder="— เลือกจังหวัดที่ถูกต้อง —"
                />
              </div>
              <button
                type="button"
                onClick={() => remap(it.value)}
                disabled={!targets[it.value] || busy !== null}
                className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-40"
              >
                {busy === it.value ? 'กำลังแก้...' : 'แก้ไข'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
