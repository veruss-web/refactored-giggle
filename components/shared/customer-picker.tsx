'use client';

/** Searchable customer selector used at checkout. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, Users, X } from 'lucide-react';
import type { Customer } from '@/lib/types';

export function CustomerPicker({customers,value,onChange}:{customers:Customer[];value:string;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false);
 const [search,setSearch]=useState('');
 const [mounted,setMounted]=useState(false);
 const triggerRef=useRef<HTMLButtonElement|null>(null);
 const menuRef=useRef<HTMLDivElement|null>(null);
 const selected=customers.find(c=>c.id===value);
 const filtered=customers.filter(c=>`${c.name} ${c.phone||''} ${c.email||''}`.toLowerCase().includes(search.trim().toLowerCase()));
 useEffect(()=>{if(value&&!customers.some(c=>c.id===value))onChange('')},[value,customers,onChange]);
 useEffect(()=>{setMounted(true)},[]);
 useEffect(()=>{
  if(!open)return;
  const close=(e:PointerEvent)=>{const target=e.target as Node;if(triggerRef.current?.contains(target)||menuRef.current?.contains(target))return;setOpen(false)};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};
  document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key)};
 },[open]);
 useEffect(()=>{if(!open)setSearch('')},[open]);
 const choose=(id:string)=>{onChange(id);setOpen(false)};
 const menu=open?<><div className="customer-picker-overlay" onPointerDown={()=>setOpen(false)} aria-hidden="true"/><div ref={menuRef} className="customer-picker-menu customer-picker-portal" role="dialog" aria-label="Pilih pelanggan">
  <div className="customer-picker-head"><div><span>PILIH PELANGGAN</span><b>{customers.length+1} pilihan</b></div><button type="button" onClick={()=>setOpen(false)} aria-label="Tutup"><X size={17}/></button></div>
  <label className="customer-picker-search"><Search size={16}/><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama atau nomor telepon..."/></label>
  <div className="customer-picker-list">
   <button type="button" className={!value?'active':''} onClick={()=>choose('')} role="option" aria-selected={!value}><span className="customer-picker-avatar general"><Users size={17}/></span><span><b>Pelanggan umum</b><small>Transaksi tanpa data pelanggan</small></span>{!value&&<Check size={17}/>}</button>
   {filtered.map(c=><button type="button" key={c.id} className={value===c.id?'active':''} onClick={()=>choose(c.id)} role="option" aria-selected={value===c.id}><span className="customer-picker-avatar">{(c.name||'?').slice(0,1).toUpperCase()}</span><span><b>{c.name}</b><small>{c.phone||c.email||'Data kontak belum diisi'}</small></span>{value===c.id&&<Check size={17}/>}</button>)}
   {!filtered.length&&<div className="customer-picker-empty"><Search size={22}/><b>Pelanggan tidak ditemukan</b><span>Coba nama atau nomor telepon lain.</span></div>}
  </div>
 </div></>:null;
 return <div className={`customer-picker ${open?'open':''}`}>
  <button ref={triggerRef} type="button" className="customer-picker-trigger" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="dialog"><div><span className={`customer-picker-avatar ${!selected?'general':''}`}>{selected?(selected.name||'?').slice(0,1).toUpperCase():'U'}</span><span className="customer-picker-selected"><b>{selected?.name||'Pelanggan umum'}</b><small>{selected?.phone||'Transaksi tanpa data pelanggan'}</small></span></div><ChevronDown size={17}/></button>
  {mounted&&menu&&createPortal(menu,document.body)}
 </div>
}
