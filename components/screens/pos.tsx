'use client';

/** Kasir (point of sale): catalog, cart, payment and receipt. */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Boxes, Package, Printer, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { ensureFreshSession, friendlySupabaseError, runWithAuthRetry, supabase } from '@/lib/supabase';
import { CustomerPicker } from '@/components/shared/customer-picker';
import { money } from '@/lib/format';
import { RECEIPT_STORE } from '@/lib/store';
import type { CartItem, Category, Customer, OrderItem, Product } from '@/lib/types';

export function POS({products,categories,customers,query,onDone,onStockChange}:{products:Product[];categories:Category[];customers:Customer[];query:string;onDone:(receipt:any,soldItems:CartItem[],newOrderItems?:OrderItem[])=>void;onStockChange:(id:string,stock:number)=>void}){
 const [activeCategory,setActiveCategory]=useState('Semua');
 const [cart,setCart]=useState<CartItem[]>([]);
 const [customer,setCustomer]=useState('');
 const [customerOpen,setCustomerOpen]=useState(false);
 const [customerSearch,setCustomerSearch]=useState('');
 const [note,setNote]=useState('');
 const [payment,setPayment]=useState<'cash'|'ewallet'|'atm'>('cash');
 const [paid,setPaid]=useState('');
 const [saving,setSaving]=useState(false);
 const [receipt,setReceipt]=useState<any>(null);
 const [receiptPaper,setReceiptPaper]=useState<'58'|'80'>('80');
 const [paymentError,setPaymentError]=useState('');
 const menuCategories=['Semua',...categories.map(c=>c.name)];
 const q=(query||'').trim().toLowerCase();
 const customerQ=customerSearch.trim().toLowerCase();
 const visibleCustomers=customers.filter(c=>!customerQ||[c.name||'',c.phone||'',c.email||''].join(' ').toLowerCase().includes(customerQ));
 useEffect(()=>{if(customer&&!customers.some(c=>c.id===customer))setCustomer('')},[customer,customers]);
 const visibleProducts=products.filter(p=>p.is_active&&p.stock>0&&(activeCategory==='Semua'||p.categories?.name===activeCategory)&&(!q||[p.name,p.description||'',p.categories?.name||'',String(p.stock),String(p.price)].join(' ').toLowerCase().includes(q)));
 const total=cart.reduce((a,p)=>a+Number(p.price)*p.qty,0);
 const paymentOptions=[
  {value:'cash' as const,label:'Tunai',hint:'Pembayaran tunai secara langsung',icon:'Rp',tone:'cash'},
  {value:'ewallet' as const,label:'E-Wallet',hint:'Pembayaran melalui e-wallet',icon:'▰',tone:'dana'},
  {value:'atm' as const,label:'ATM',hint:'Pembayaran melalui kartu debit atau ATM',icon:'⌁',tone:'bank'}
 ];
 const changeStock=async(p:Product,delta:number)=>{
  const result=await runWithAuthRetry(()=>supabase.rpc('adjust_product_stock',{p_product_id:p.id,p_quantity_delta:delta}));
  if(result.error)throw result.error;
  const nextStock=Number(result.data?.stock);
  if(!Number.isFinite(nextStock))throw new Error('Stok produk tidak dapat diperbarui.');
  onStockChange(p.id,nextStock);
  return nextStock;
 };
 const add=async(p:Product)=>{
  setPaymentError('');
  try{
   if(!p.is_active||p.stock<=0)throw new Error(`Stok ${p.name} sudah habis.`);
   const nextStock=await changeStock(p,-1);
   setCart(c=>c.some(x=>x.id===p.id)
    ?c.map(x=>x.id===p.id?{...x,qty:x.qty+1,stock:nextStock}:x)
    :[...c,{...p,qty:1,stock:nextStock}]);
  }catch(err:any){setPaymentError(friendlySupabaseError(err));}
 };
 const decrease=async(p:CartItem)=>{
  if(p.qty<=1)return;
  try{
   const nextStock=await changeStock(p,1);
   setCart(c=>c.map(x=>x.id===p.id?{...x,qty:x.qty-1,stock:nextStock}:x));
  }catch(err:any){setPaymentError(friendlySupabaseError(err));}
 };
 const removeItem=async(p:CartItem)=>{
  try{
   const nextStock=await changeStock(p,p.qty);
   setCart(c=>c.filter(x=>x.id!==p.id));
  }catch(err:any){setPaymentError(friendlySupabaseError(err));}
 };
 const checkout=async()=>{
  if(!cart.length||saving)return;
  setSaving(true);setPaymentError('');
  try{
   const amount=payment==='cash'?Number(paid||0):total;
   const result=await runWithAuthRetry(()=>supabase.rpc('create_sale',{p_customer_id:customer||null,p_payment_method:payment,p_amount_paid:amount,p_items:cart.map(x=>({product_id:x.id,quantity:x.qty})),p_note:note.trim()||null}));
   if(result.error)throw result.error;
   const soldItems=cart.map(x=>({...x}));
   const createdOrderId=result.data?.id;
   let newOrderItems:OrderItem[]=[];
   if(createdOrderId){
    const sessionNow=await ensureFreshSession();
    const itemResult=await runWithAuthRetry(()=>supabase.from('order_items').select('*').eq('order_id',createdOrderId).eq('owner_id',sessionNow!.user.id));
    if(!itemResult.error) newOrderItems=(itemResult.data||[]) as OrderItem[];
   }
   const receiptData={...result.data,customer_id:customer||null,payment_method:payment,notes:note.trim()||null,created_at:new Date().toISOString(),items:soldItems};setReceipt(receiptData);setCart([]);setPaid('');setNote('');onDone(receiptData,soldItems,newOrderItems);
  }catch(err:any){setPaymentError(friendlySupabaseError(err));}
  finally{setSaving(false)}
 };
 const change=Math.max(0,Number(paid||0)-total);
 const printReceipt=()=>{
  const receiptNode=document.querySelector(`.premium-receipt.thermal-${receiptPaper}`) as HTMLElement|null;
  if(!receiptNode){window.print();return;}
  const receiptClone=receiptNode.cloneNode(true) as HTMLElement;
  receiptClone.querySelector('.receipt-print-controls')?.remove();
  const paperWidth=receiptPaper==='58'?'58mm':'80mm';
  const printWindow=window.open('', '_blank');
  if(!printWindow){window.print();return;}
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Struk ${receipt.order_number||''}</title><style>
   @page{size:${paperWidth} auto;margin:0}
   *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}body{width:${paperWidth};max-width:${paperWidth}}
   .premium-receipt{display:block;width:${paperWidth};max-width:${paperWidth};padding:${receiptPaper==='58'?'3mm':'4mm'};margin:0;background:#fff;color:#000;font-size:${receiptPaper==='58'?'8pt':'9pt'};overflow:hidden}
   .receipt-store-header{text-align:center;padding:1mm 0 2.5mm;border-bottom:.25mm dashed #555}.receipt-store-brand{font-size:${receiptPaper==='58'?'14pt':'16pt'};font-weight:900;letter-spacing:.04em;line-height:1.1}.receipt-store-address{margin-top:1.2mm;font-size:7pt;line-height:1.45;color:#222}.receipt-store-contact{margin-top:.8mm;font-size:6.5pt;color:#444}
   .receipt-document-title{text-align:center;font-size:7pt;font-weight:800;letter-spacing:.16em;padding:2.5mm 0 1.5mm}.receipt-transaction-info{display:grid;gap:1mm;padding-bottom:2mm;border-bottom:.2mm dashed #777}.receipt-info-row{display:flex;justify-content:space-between;gap:3mm;font-size:7pt}.receipt-info-row span{color:#444}.receipt-info-row b{text-align:right;font-size:7pt}.receipt-success{display:none}
   .receipt-items{margin-top:2mm;border:0}.receipt-items-head{display:flex;justify-content:space-between;padding:1.5mm 0;border-bottom:.25mm solid #000}.receipt-items-head span{font-size:8pt;font-weight:800}.receipt-items-head small{font-size:7pt;color:#333}.receipt-item-list{padding:0}.receipt-item{display:flex;justify-content:space-between;align-items:flex-start;gap:3mm;padding:2mm 0;border-bottom:.2mm dashed #999;break-inside:avoid}.receipt-item-info{min-width:0;display:grid;gap:1mm}.receipt-item-info b{font-size:8pt;white-space:normal;overflow:visible}.receipt-item-info small{font-size:7pt;color:#333}.receipt-item>strong{font-size:8pt;white-space:nowrap}
   .receipt-totals{margin-top:2mm;padding:1.5mm 0;border-top:.25mm solid #000;border-bottom:.25mm solid #000}.receipt-total-row{display:flex;justify-content:space-between;gap:3mm;padding:1mm 0;font-size:8pt}.receipt-total-row.grand{padding-top:2mm;font-size:10pt;font-weight:900}.receipt-total-row.grand b{font-size:${receiptPaper==='58'?'12pt':'14pt'}}.receipt-payment-detail{margin-top:2mm;display:grid;gap:1mm;padding-bottom:2mm;border-bottom:.2mm dashed #777}.receipt-payment-detail .receipt-info-row{font-size:7pt}
   .receipt-footer{text-align:center;padding-top:3mm;display:grid;gap:1.2mm}.receipt-footer b{font-size:8pt}.receipt-footer span{font-size:7pt;line-height:1.45;color:#222}.receipt-footer small{font-size:6pt;color:#555}.receipt-print-controls{display:none!important}
  </style></head><body>${receiptClone.outerHTML}</body></html>`);
  printWindow.document.close();
  const startPrint=()=>{printWindow.focus();setTimeout(()=>printWindow.print(),250)};
  if(printWindow.document.readyState==='complete')setTimeout(startPrint,120);else printWindow.onload=startPrint;
 };
 return <div className="pos-reference-page">
  <section className="pos-catalog">
   <div className="reference-category-head"><div><span>Menu Produk</span></div><div className="view-switch"><button className="active" type="button"><Boxes size={16}/></button><button type="button"><SlidersHorizontal size={16}/></button></div></div>
   <div className="reference-categories">{menuCategories.map((c,i)=><button type="button" key={c} className={activeCategory===c?'active':''} onClick={()=>setActiveCategory(c)}>{i===0?<ShoppingBag size={16}/>:<Package size={15}/>}<span>{c}</span></button>)}</div>
   {q&&<div className="pos-search-result-head"><div><span>HASIL PENCARIAN</span><h3>{visibleProducts.length?`${visibleProducts.length} produk ditemukan`:'Produk tidak ditemukan'}</h3><p>Menampilkan menu yang cocok dengan <b>“{query}”</b></p></div><div className="pos-search-query"><Search size={15}/><span>{query}</span><b>{visibleProducts.length}</b></div></div>}
   <div className={`reference-product-grid ${q?'is-searching':''}`}>{visibleProducts.map(p=><motion.div whileTap={{scale:.995}} className="reference-product-card" key={p.id}>
    <div className="reference-food-image">{p.image_url?<img src={p.image_url} alt={p.name}/>:<span>🍜</span>}<em>Stok {p.stock}</em></div>
    <div className="reference-product-info"><b>{p.name}</b><strong>{money(Number(p.price))}</strong><button type="button" onClick={(event)=>{add(p);event.currentTarget.blur()}} aria-label={`Tambah ${p.name} ke pesanan`}>＋&nbsp; Tambah Menu</button></div>
   </motion.div>)}</div>
   {!visibleProducts.length&&<div className="reference-product-empty pos-search-empty"><div className="pos-search-empty-icon"><Search size={24}/></div><b>Tidak ada produk yang cocok</b><span>Coba gunakan nama menu atau kategori lain.</span></div>}
  </section>

  <section className="reference-order-panel">
   <div className="reference-order-left">
    <div className="reference-order-head"><h2><ShoppingBag size={20}/> Pesanan ({cart.length})</h2></div>
    <div className="reference-order-items">
     {cart.map((p,index)=><div className="reference-order-item" key={p.id}>
      <span className="reference-order-number">{index+1}</span>
      <div className="reference-order-thumb">{p.image_url?<img src={p.image_url} alt=""/>:<span>🍜</span>}</div>
      <div className="reference-order-main"><b>{p.name}</b><small>{money(Number(p.price))}</small></div>
      <div className="reference-stepper"><button type="button" onClick={()=>decrease(p)} disabled={saving}>−</button><b>{p.qty}</b><button type="button" onClick={()=>add(p)} disabled={saving||p.stock<=0}>+</button></div>
      <strong>{money(Number(p.price)*p.qty)}</strong>
      <button type="button" className="reference-order-remove" disabled={saving} onClick={()=>removeItem(p)}><Trash2 size={16}/></button>
     </div>)}
     {!cart.length&&<div className="reference-order-empty"><ShoppingBag size={24}/><b>Belum ada pesanan</b><span>Pilih produk di atas untuk menambah pesanan.</span></div>}
    </div>
    <div className="reference-order-fields">
     <div className="reference-field reference-customer-field">
      <span>Pelanggan</span>
      <CustomerPicker customers={customers} value={customer} onChange={setCustomer}/>
     </div>
     <label className="reference-field"><span>Catatan (Opsional)</span><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Contoh: Tidak pakai cabe, extra pedas, dll"/></label>
    </div>
   </div>

   <div className="reference-payment-panel">
    <span className="payment-methods-label">Metode Pembayaran</span>
    <div className="reference-payment-options">{paymentOptions.map(option=><button type="button" key={option.value} className={payment===option.value?'active':''} onClick={()=>{setPayment(option.value);if(option.value!=='cash')setPaid('')}}>
     <i className={option.tone}>{option.icon}</i><span><b>{option.label}</b><small>{option.hint}</small></span><em>✓</em>
    </button>)}</div>
    {payment==='cash'&&<div className="reference-cash-area"><label>Nominal diterima</label><div className="reference-cash-input"><span>Rp</span><input type="number" min={total} value={paid} onChange={e=>setPaid(e.target.value)} placeholder={String(total||0)}/></div>{Number(paid)>0&&<small>Kembalian: <b>{money(change)}</b></small>}</div>}
    <div className="reference-secure"><ShieldCheck size={18}/><span>Semua pembayaran aman dan terpercaya</span></div>
    <div className="reference-payment-total"><div><span>Subtotal</span><b>{money(total)}</b></div><div className="grand"><span>Total pembayaran</span><strong>{money(total)}</strong></div></div>
    {paymentError&&<div className="error payment-error"><span>{paymentError}</span><button onClick={()=>setPaymentError('')}><X size={16}/></button></div>}
    <div className="reference-cart-actions reference-cart-actions-premium"><button type="button" className="reference-pay" disabled={!cart.length||saving||(payment==='cash'&&Number(paid)<total)} onClick={checkout}><ShoppingBag size={17}/> {saving?'Memproses…':'Bayar sekarang'}<kbd>F9</kbd></button></div>
    {receipt&&<div className={`receipt premium-receipt thermal-${receiptPaper}`}>
     <div className="receipt-store-header">
      <div className="receipt-store-brand">{RECEIPT_STORE.name}</div>
      <div className="receipt-store-address">{RECEIPT_STORE.address}</div>
      {RECEIPT_STORE.phone&&<div className="receipt-store-contact">Tel. {RECEIPT_STORE.phone}</div>}
     </div>
     <div className="receipt-document-title">BUKTI PEMBAYARAN</div>
     <div className="receipt-transaction-info">
      <div className="receipt-info-row"><span>No. Transaksi</span><b>#{receipt.order_number||receipt.id}</b></div>
      <div className="receipt-info-row"><span>Tanggal</span><b>{new Date(receipt.created_at||Date.now()).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</b></div>
      <div className="receipt-info-row"><span>Pembayaran</span><b>{receipt.payment_method==='cash'?'Tunai':receipt.payment_method==='qris'||receipt.payment_method==='ewallet'?'E-Wallet':'ATM'}</b></div>
     </div>
     <div className="receipt-items">
      <div className="receipt-items-head"><span>ITEM PESANAN</span><small>{(receipt.items||[]).reduce((sum:any,item:any)=>sum+Number(item.qty||0),0)} item</small></div>
      <div className="receipt-item-list">{(receipt.items||[]).map((item:any,index:number)=><div className="receipt-item" key={`${item.id}-${index}`}><div className="receipt-item-info"><b>{item.name}</b><small>{item.qty} × {money(Number(item.price||0))}</small></div><strong>{money(Number(item.price||0)*Number(item.qty||0))}</strong></div>)}</div>
     </div>
     <div className="receipt-totals">
      <div className="receipt-total-row"><span>Subtotal</span><b>{money(Number(receipt.subtotal??receipt.total??0))}</b></div>
      <div className="receipt-total-row"><span>Dibayar</span><b>{money(Number(receipt.amount_paid??receipt.total??0))}</b></div>
      <div className="receipt-total-row grand"><span>TOTAL</span><b>{money(Number(receipt.total||0))}</b></div>
     </div>
     <div className="receipt-payment-detail">
      <div className="receipt-info-row"><span>Kembalian</span><b>{money(receipt.change_due||0)}</b></div>
      <div className="receipt-info-row"><span>Status</span><b className="receipt-paid">BERHASIL</b></div>
     </div>
     <div className="receipt-footer"><b>Terima kasih</b><span>{RECEIPT_STORE.footer}</span><small>Simpan struk ini sebagai bukti transaksi.</small></div>
     <div className="receipt-print-controls" aria-label="Pengaturan cetak thermal">
      <div className="receipt-paper-picker">
       <button type="button" className={receiptPaper==='58'?"active":""} onClick={()=>setReceiptPaper('58')}>58 mm</button>
       <button type="button" className={receiptPaper==='80'?"active":""} onClick={()=>setReceiptPaper('80')}>80 mm</button>
      </div>
      <button type="button" className="receipt-print-button" onClick={printReceipt}><Printer size={17}/> Cetak struk {receiptPaper}mm</button>
     </div>
    </div>}
   </div>
  </section>
 </div>
}
