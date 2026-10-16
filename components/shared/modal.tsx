'use client';

/** Create/edit dialog (product, category, customer) and the delete confirmation dialog. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, ChevronDown, ImageIcon, Mail, Tags, Trash2, UploadCloud, UserRound, Users, X } from 'lucide-react';
import { ensureFreshSession, friendlySupabaseError, runWithAuthRetry, supabase } from '@/lib/supabase';
import { Field } from '@/components/shared/primitives';
import { money } from '@/lib/format';
import type { Category } from '@/lib/types';

export function DeleteConfirmDialog({data,onCancel,onConfirm}:{data:any;onCancel:()=>void;onConfirm:()=>void}){return <motion.div className="delete-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={e=>{if(e.target===e.currentTarget)onCancel()}}><motion.div className="delete-dialog" initial={{opacity:0,y:18,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:.98}} transition={{duration:.18}} role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="delete-icon"><Trash2 size={22}/></div><div className="delete-copy"><span className="delete-eyebrow">KONFIRMASI PENGHAPUSAN</span><h2 id="delete-title">Hapus {data.label}?</h2><p><b>{data.name}</b> akan dihapus secara permanen dari data Mieflow.</p></div><div className="delete-actions"><button type="button" className="delete-cancel" onClick={onCancel}>Batal</button><button type="button" className="delete-confirm" onClick={onConfirm}><Trash2 size={16}/> Hapus permanen</button></div></motion.div></motion.div>}

export function Modal({type,initial,categories,onClose,onSave}:any){
 const defaults:any={product:{name:'',description:'',price:0,cost:0,stock:0,image_url:'',category_id:'',is_active:true},category:{name:'',color:'#111827'},customer:{name:'',phone:'',email:'',notes:''}};
 const [form,setForm]=useState<any>({...defaults[type],...(initial||{})}),[uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState(''),[categoryOpen,setCategoryOpen]=useState(false),[categorySearch,setCategorySearch]=useState('');
 const categoryTriggerRef=useRef<HTMLButtonElement|null>(null);
 const [categoryPanelPos,setCategoryPanelPos]=useState<{left:number;top:number;width:number;maxHeight:number;openUp:boolean}|null>(null);
 const set=(k:string,v:any)=>setForm((f:any)=>({...f,[k]:v}));
 useEffect(()=>{
  if(!categoryOpen || typeof window==='undefined' || window.innerWidth<768){setCategoryPanelPos(null);return;}
  const update=()=>{
   const el=categoryTriggerRef.current;if(!el)return;
   const r=el.getBoundingClientRect();
   const gap=8, viewportPad=16;
   const optionCount=categories.length+1;
   const columns=window.innerWidth>=768?2:1;
   const rows=Math.ceil(optionCount/columns);
   const desired=Math.min(500, Math.max(280, rows*82+28));
   const below=Math.max(0,window.innerHeight-r.bottom-gap-viewportPad);
   const above=Math.max(0,r.top-gap-viewportPad);
   const openUp=below<Math.min(280,desired) && above>below;
   const available=Math.max(170,Math.floor(openUp?above:below));
   const height=Math.min(desired,available,Math.max(170,window.innerHeight-(viewportPad*2)));
   const top=openUp
     ?Math.max(viewportPad,r.top-gap-height)
     :Math.min(Math.max(viewportPad,r.bottom+gap),window.innerHeight-height-viewportPad);
   const width=Math.min(Math.max(r.width,360),window.innerWidth-viewportPad*2);
   const left=Math.min(Math.max(r.left,viewportPad),window.innerWidth-width-viewportPad);
   setCategoryPanelPos({left,top,width,maxHeight:height,openUp});
  };
  update();
  window.addEventListener('resize',update);
  window.addEventListener('scroll',update,true);
  return()=>{window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true)};
 },[categoryOpen]);
 const compressImage=async(file:File)=>new Promise<string>((resolve,reject)=>{
   const reader=new FileReader();
   reader.onerror=()=>reject(new Error('Foto tidak bisa dibaca.'));
   reader.onload=()=>{
     const img=new Image();
     img.onerror=()=>reject(new Error('Format foto tidak didukung.'));
     img.onload=()=>{
       const max=900,scale=Math.min(1,max/Math.max(img.width,img.height));
       const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(img.width*scale)); canvas.height=Math.max(1,Math.round(img.height*scale));
       const ctx=canvas.getContext('2d'); if(!ctx)return reject(new Error('Browser tidak mendukung pemrosesan foto.'));
       ctx.drawImage(img,0,0,canvas.width,canvas.height);
       resolve(canvas.toDataURL('image/webp',0.78));
     };
     img.src=String(reader.result);
   };
   reader.readAsDataURL(file);
 });
 const upload=async(file:File)=>{
   setUploadError('');
   if(!file.type.startsWith('image/')){setUploadError('Pilih foto dari Gallery dalam format JPG, PNG, WEBP, atau GIF.');return}
   if(file.size>10*1024*1024){setUploadError('Ukuran foto maksimal 10 MB.');return}
   setUploading(true);
   try{
     await ensureFreshSession();
     const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
     const userId=(await ensureFreshSession())?.user.id;
     if(!userId) throw new Error('Sesi login tidak ditemukan.');
     const path=`${userId}/products/${crypto.randomUUID()}.${ext}`;
     const uploadResult=await runWithAuthRetry(()=>supabase.storage.from('product-images').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'}));
     if(uploadResult.error)throw uploadResult.error;
     const {data}=supabase.storage.from('product-images').getPublicUrl(path);
     if(!data?.publicUrl)throw new Error('URL foto tidak tersedia.');
     set('image_url',data.publicUrl);
   }catch(err:any){
     try{const fallback=await compressImage(file);set('image_url',fallback);setUploadError(`${friendlySupabaseError(err)} Foto tetap dipakai sebagai preview lokal; setelah database siap produk dapat disimpan.`);}
     catch(processErr:any){setUploadError(processErr?.message||'Foto gagal diproses.');}
   }finally{setUploading(false)}
 };
 const margin=Number(form.price||0)-Number(form.cost||0);
 const marginPct=Number(form.price||0)>0?Math.max(0,Math.round((margin/Number(form.price))*100)):0;
 const product=type==='product';
 return <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={onClose}>
  <motion.form className={`modal ${product?'product-modal':''}`} initial={{y:20,scale:.97}} animate={{y:0,scale:1}} onMouseDown={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();onSave(type,form)}}>
   {product&&<div className="mobile-sheet-handle" aria-hidden="true"/>}
   <div className="modal-head modern-head"><div><span>{initial?'EDIT DATA':'DATA BARU'}</span><h2>{product?'Tambah produk':type==='category'?'Tambah kategori':'Tambah pelanggan'}</h2><p>{product?'Lengkapi informasi produk agar mudah ditemukan saat transaksi.':''}</p></div><button type="button" aria-label="Tutup" onClick={onClose}><X size={18}/></button></div>
   {product&&<div className="product-form-layout">
    <div className="product-media-card">
      <div className="section-kicker"><ImageIcon size={14}/> Foto produk</div>
      <div className={`image-drop ${form.image_url?'has-image':''}`}>
       {form.image_url?<><img src={form.image_url} alt="Preview produk"/><button type="button" className="image-remove" onClick={()=>set('image_url','')}><X size={15}/></button></>:<><UploadCloud size={27}/><b>{uploading?'Mengunggah…':'Upload foto produk'}</b><span>JPG, PNG atau WEBP</span><small>Maks. 5 MB</small></>}
       <input id="product-image" hidden type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)upload(file);e.currentTarget.value=''}}/>
       {!form.image_url&&<label htmlFor="product-image" className="image-drop-action">Pilih dari galeri</label>}
       {form.image_url&&<label htmlFor="product-image" className="image-change">Ganti foto</label>}
      </div>
      {uploadError&&<div className="upload-status"><span>{uploadError}</span></div>}
    </div>
    <div className="product-fields">
      <div className="form-section"><div className="section-title"><span>Informasi dasar</span><small>Wajib</small></div>
       <Field label="Nama produk" value={form.name} onChange={(v:any)=>set('name',v)} placeholder="Contoh: Mie Ayam Spesial" required/>
       <label>Deskripsi <textarea value={form.description??''} onChange={e=>set('description',e.target.value)} placeholder="Deskripsi singkat produk (opsional)" rows={3}/></label>
      </div>
      <div className="form-section"><div className="section-title"><span>Harga & stok</span><small>Dalam Rupiah</small></div>
       <div className="form-grid three"><Field label="Harga jual" type="number" value={form.price} onChange={(v:any)=>set('price',v)} placeholder="0" required/><Field label="Harga modal" type="number" value={form.cost} onChange={(v:any)=>set('cost',v)} placeholder="0"/><Field label="Stok awal" type="number" value={form.stock} onChange={(v:any)=>set('stock',v)} placeholder="0"/></div>
       <div className="margin-preview"><span>Estimasi margin</span><b>{money(margin)}</b><em>{marginPct}%</em></div>
      </div>
      <div className="form-section"><div className="section-title"><span>Kategori & status</span></div>
       <div className="category-picker-field"><label>Kategori produk</label><button ref={categoryTriggerRef} type="button" className={`category-picker-trigger ${categoryOpen?'is-open':''}`} onClick={()=>setCategoryOpen(v=>!v)} aria-expanded={categoryOpen}><span className="category-picker-symbol"><Tags size={18}/></span><span className="category-picker-value">{categories.find((c:Category)=>c.id===form.category_id)?.name||'Pilih kategori produk'}<small>{form.category_id?'Kategori produk dipilih':'Pilih kategori yang sesuai'}</small></span><ChevronDown size={19} className="category-picker-chevron"/></button>{categoryOpen&&<>{typeof window!=='undefined' && window.innerWidth>=768 && categoryPanelPos ? createPortal(<div className={`category-picker-panel category-picker-panel-floating ${categoryPanelPos.openUp?'open-up':''}`} style={{position:'fixed',left:categoryPanelPos.left,top:categoryPanelPos.top,width:categoryPanelPos.width,height:categoryPanelPos.maxHeight,maxHeight:categoryPanelPos.maxHeight,zIndex:30000,'--category-picker-height':`${categoryPanelPos.maxHeight}px`} as React.CSSProperties}><div className="category-picker-options"><button type="button" className={`category-picker-option ${!form.category_id?'selected':''}`} onClick={()=>{set('category_id','');setCategoryOpen(false)}}><span className="category-option-icon category-option-icon-unified"><Tags size={21}/></span><span className="category-option-copy">Tanpa kategori<small>Tidak dikelompokkan</small></span><i>{!form.category_id&&<Check size={16}/>}</i></button>{categories.map((c:Category)=>{const Icon=Tags;return <button type="button" key={c.id} className={`category-picker-option ${form.category_id===c.id?'selected':''}`} onClick={()=>{set('category_id',c.id);setCategoryOpen(false)}}><span className="category-option-icon category-option-icon-unified"><Icon size={21}/></span><span className="category-option-copy">{c.name}<small>Kategori produk</small></span><i>{form.category_id===c.id&&<Check size={16}/>}</i></button>})}{!categories.length&&<div className="category-picker-empty">Belum ada kategori. Tambahkan kategori terlebih dahulu.</div>}</div></div>,document.body):<div className="category-picker-panel"><div className="category-picker-options"><button type="button" className={`category-picker-option ${!form.category_id?'selected':''}`} onClick={()=>{set('category_id','');setCategoryOpen(false)}}><span className="category-option-icon category-option-icon-unified"><Tags size={21}/></span><span className="category-option-copy">Tanpa kategori<small>Tidak dikelompokkan</small></span><i>{!form.category_id&&<Check size={16}/>}</i></button>{categories.map((c:Category)=>{const Icon=Tags;return <button type="button" key={c.id} className={`category-picker-option ${form.category_id===c.id?'selected':''}`} onClick={()=>{set('category_id',c.id);setCategoryOpen(false)}}><span className="category-option-icon category-option-icon-unified"><Icon size={21}/></span><span className="category-option-copy">{c.name}<small>Kategori produk</small></span><i>{form.category_id===c.id&&<Check size={16}/>}</i></button>})}{!categories.length&&<div className="category-picker-empty">Belum ada kategori. Tambahkan kategori terlebih dahulu.</div>}</div></div>}</>}</div>
       <div className="active-toggle"><div><b>Produk aktif</b><span>Produk dapat dijual dari halaman POS.</span></div><button type="button" className={`switch ${form.is_active?'on':''}`} aria-label="Status produk" onClick={()=>set('is_active',!form.is_active)}><i/></button></div>
      </div>
    </div>
   </div>}
   {type==='category'&&<div className="simple-form"><Field label="Nama" value={form.name} onChange={(v:any)=>set('name',v)} required/><Field label="Warna" type="color" value={form.color} onChange={(v:any)=>set('color',v)}/></div>}
   {type==='customer'&&<div className="customer-form">
    <div className="customer-form-intro"><div className="customer-form-icon"><Users size={20}/></div><div><b>Profil pelanggan</b><span>Simpan data pelanggan agar transaksi dan riwayat lebih mudah dikelola.</span></div></div>
    <div className="customer-form-grid">
      <label className="customer-field full"><span>Nama pelanggan <em>Wajib</em></span><div><UserRound size={17}/><input required value={form.name??''} placeholder="Contoh: Budi Santoso" onChange={e=>set('name',e.target.value)}/></div></label>
      <label className="customer-field"><span>Nomor telepon</span><div><span className="field-prefix">+62</span><input inputMode="tel" value={(form.phone??'').replace(/^\+62\s?/,'')} placeholder="812 3456 7890" onChange={e=>set('phone',e.target.value)}/></div></label>
      <label className="customer-field"><span>Email</span><div><Mail size={17}/><input type="email" value={form.email??''} placeholder="nama@email.com" onChange={e=>set('email',e.target.value)}/></div></label>
      <label className="customer-field full"><span>Catatan <small>Opsional</small></span><div className="textarea-wrap"><textarea value={form.notes??''} placeholder="Catatan atau preferensi pelanggan…" rows={4} onChange={e=>set('notes',e.target.value)}/></div></label>
    </div>
   </div>}
   <div className="modal-foot"><button type="button" className="secondary" onClick={onClose}>Batal</button><button className="primary" disabled={uploading}>{initial?'Simpan perubahan':type==='customer'?'Simpan pelanggan':type==='category'?'Simpan kategori':'Simpan produk'} <Check size={17}/></button></div>
  </motion.form>
 </motion.div>
}
