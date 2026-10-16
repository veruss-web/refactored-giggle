'use client';

/** Inventory: stock levels and manual adjustments. */
import { useState } from 'react';
import { AlertTriangle, Boxes, CheckCircle2, Clock3, MapPin, Package, PackageOpen, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { ensureFreshSession, friendlySupabaseError, runWithAuthRetry, supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';

export function Inventory({products,query,onStockChange,onAdd,onDelete,onError}:{products:Product[];query:string;onStockChange:(id:string,stock:number)=>void;onAdd:()=>void;onDelete:(id:string)=>void;onError?:(message:string)=>void}){
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState<'all'|'good'|'low'|'out'>('all');
 const [filterOpen,setFilterOpen]=useState(false);
 const [busy,setBusy]=useState<string|null>(null);
 const [localStock,setLocalStock]=useState<Record<string,number>>({});
 const totalUnits=products.reduce((sum,p)=>sum+Math.max(0,Number(p.stock)||0),0);
 const low=products.filter(p=>p.stock>0&&p.stock<5);
 const out=products.filter(p=>p.stock<=0);
 const filtered=products.filter(p=>{
  const q=(search||query||'').trim().toLowerCase();
  const matches=!q||[p.name,p.description||'',p.categories?.name||'',String(p.stock),String(p.price)].join(' ').toLowerCase().includes(q);
  const status=filter==='good'?p.stock>=5:filter==='low'?p.stock>0&&p.stock<5:filter==='out'?p.stock<=0:true;
  return matches&&status;
 });
 const adjust=async(p:Product,d:number)=>{
  try{
   setBusy(p.id);
   const sessionNow=await ensureFreshSession();
   if(!sessionNow)throw new Error('Sesi login sudah berakhir. Silakan login kembali.');
   const current=localStock[p.id]??p.stock;
   const next=Math.max(0,current+d);
   if(next===current)return;
   // Compare-and-swap: tulis hanya jika stok di database masih sama dengan yang tampil di layar.
   // Mencegah penyesuaian manual menimpa penjualan yang masuk dari perangkat lain.
   const res=await runWithAuthRetry(()=>supabase.from('products').update({stock:next}).eq('id',p.id).eq('owner_id',sessionNow.user.id).eq('stock',current).select('stock'));
   if(res.error)throw res.error;
   if(!res.data||res.data.length===0){
    const fresh=await runWithAuthRetry(()=>supabase.from('products').select('stock').eq('id',p.id).eq('owner_id',sessionNow.user.id).maybeSingle());
    if(!fresh.error&&fresh.data){const latest=Number(fresh.data.stock);setLocalStock(prev=>({...prev,[p.id]:latest}));onStockChange(p.id,latest);}
    throw new Error('Stok produk ini sudah berubah di perangkat lain. Angka stok sudah diperbarui, silakan ulangi penyesuaian.');
   }
   const movement=await runWithAuthRetry(()=>supabase.from('stock_movements').insert({owner_id:sessionNow.user.id,product_id:p.id,quantity_delta:next-current,reason:'manual adjustment'}));
   if(movement.error)console.warn('Riwayat stok tidak tersimpan:',movement.error);
   setLocalStock(prev=>({...prev,[p.id]:next}));
   onStockChange(p.id,next);
  }catch(err:any){const message=friendlySupabaseError(err);if(onError)onError(message);else console.error(message)}finally{setBusy(null)}
 };
 const statusOf=(stock:number)=>stock<=0?'Out of stock':stock<5?'Low stock':'Good';
 const statusClass=(stock:number)=>stock<=0?'out':stock<5?'low':'good';
 return <div className="inventory-page">
  <div className="inventory-hero">
   <div><span className="eyebrow">STOCK CONTROL</span><h1>Inventory Management</h1><p>Pantau ketersediaan produk dan lakukan penyesuaian stok dengan cepat.</p></div>
   <div className="inventory-hero-actions"><button className="primary inventory-add" onClick={onAdd}><Plus size={16}/> Tambah produk</button></div>
  </div>
  <div className="inventory-kpis">
   <InventoryKpi icon={Boxes} tone="teal" label="Total items" value={totalUnits.toLocaleString('id-ID')} detail={`${products.length} produk terdaftar`}/>
   <InventoryKpi icon={AlertTriangle} tone="amber" label="Low stock" value={low.length} detail="Perlu perhatian"/>
   <InventoryKpi icon={PackageOpen} tone="rose" label="Out of stock" value={out.length} detail="Tidak tersedia"/>
   <InventoryKpi icon={CheckCircle2} tone="green" label="Good stock" value={products.filter(p=>p.stock>=5).length} detail="Stok aman"/>
  </div>
  <section className="surface inventory-overview">
   <div className="inventory-section-head"><div><span className="section-label">INVENTORY OVERVIEW</span><h2>Daftar persediaan</h2><p>Kelola stok setiap produk dari satu tempat.</p></div><div className="inventory-health"><i/> Sistem stok aktif</div></div>
   <div className="inventory-toolbar"><label className="inventory-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari produk atau kategori..."/></label><div className="inventory-filters"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Semua <b>{products.length}</b></button><button className={filter==='low'?'active':''} onClick={()=>setFilter('low')}>Low stock <b>{low.length}</b></button><button className={filter==='out'?'active':''} onClick={()=>setFilter('out')}>Out of stock <b>{out.length}</b></button></div><button className="inventory-filter-btn" type="button" onClick={()=>setFilterOpen(v=>!v)}><SlidersHorizontal size={15}/> Filter</button></div>
   {filterOpen&&<div className="inventory-mobile-filter"><button className={filter==='all'?'active':''} onClick={()=>{setFilter('all');setFilterOpen(false)}}>Semua</button><button className={filter==='good'?'active':''} onClick={()=>{setFilter('good');setFilterOpen(false)}}>Stok aman</button><button className={filter==='low'?'active':''} onClick={()=>{setFilter('low');setFilterOpen(false)}}>Stok menipis</button><button className={filter==='out'?'active':''} onClick={()=>{setFilter('out');setFilterOpen(false)}}>Habis</button></div>}
   <div className="inventory-table-wrap"><div className="inventory-table-head"><span>Produk</span><span>Stok</span><span>Kategori</span><span>Status</span><span>Update</span><span>Aksi</span></div>
    {filtered.map(p=><div className="inventory-row" key={p.id}>
     <div className="inventory-product"><div className="inventory-thumb">{p.image_url?<img src={p.image_url} alt=""/>:<Package size={21}/>}</div><div><b>{p.name}</b><small>{p.description||'Produk Mieflow'}</small></div></div>
     <div className="inventory-qty"><strong className={statusClass(p.stock)}>{p.stock}</strong><span>unit</span></div>
     <div className="inventory-category"><span><i/><b>{p.categories?.name||'Tanpa kategori'}</b></span></div>
     <div><span className={`inventory-status ${statusClass(p.stock)}`}><i/>{statusOf(p.stock)}</span></div>
     <div className="inventory-updated"><Clock3 size={14}/><span>Baru saja</span></div>
     <div className="inventory-actions"><button disabled={busy===p.id||(localStock[p.id]??p.stock)<=0} onClick={()=>adjust({...p,stock:localStock[p.id]??p.stock},-1)} aria-label={`Kurangi stok ${p.name}`}>−</button><span>{busy===p.id?'...':(localStock[p.id]??p.stock)}</span><button disabled={busy===p.id} onClick={()=>adjust({...p,stock:localStock[p.id]??p.stock},1)} aria-label={`Tambah stok ${p.name}`}>+</button><button type="button" className="inventory-more inventory-delete" aria-label={`Hapus ${p.name}`} title={`Hapus ${p.name}`} onClick={()=>onDelete(p.id)}><Trash2 size={17}/></button></div>
    </div>)}
    {!filtered.length&&<div className="inventory-empty"><PackageOpen size={30}/><b>Produk tidak ditemukan</b><span>Coba kata kunci atau filter yang berbeda.</span></div>}
   </div>
   <div className="inventory-footer"><span>Menampilkan <b>{filtered.length}</b> dari <b>{products.length}</b> produk</span><span className="inventory-footer-note"><MapPin size={14}/> Stok tersinkron dengan POS</span></div>
  </section>
 </div>
}

export function InventoryKpi({icon:Icon,tone,label,value,detail}:{icon:any;tone:string;label:string;value:any;detail:string}){return <div className={`inventory-kpi ${tone}`}><div className="inventory-kpi-top"><span className="inventory-kpi-icon"><Icon size={18}/></span><span>{label}</span></div><strong>{value}</strong><small>{detail}</small></div>}
