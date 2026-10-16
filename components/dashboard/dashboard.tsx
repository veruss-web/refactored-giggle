'use client';

/** Application shell: data loading, realtime sync, CRUD handlers, notifications, sidebar and top bar. */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check, CheckCircle2, ChevronDown, ChevronRight, LogOut, Maximize2, Menu, Minimize2, Plus, Search, Settings, Sparkles, X } from 'lucide-react';
import { ensureFreshSession, friendlySupabaseError, runWithAuthRetry, supabase } from '@/lib/supabase';
import { GlobalSearchResults } from '@/components/dashboard/global-search';
import { Analytics } from '@/components/screens/analytics';
import { Categories } from '@/components/screens/categories';
import { Customers } from '@/components/screens/customers';
import { Inventory } from '@/components/screens/inventory';
import { OrderDetailModal, Orders } from '@/components/screens/orders';
import { Overview } from '@/components/screens/overview';
import { POS } from '@/components/screens/pos';
import { Products } from '@/components/screens/products';
import { DeleteConfirmDialog, Modal } from '@/components/shared/modal';
import { isCustomerOrderComplete } from '@/lib/customers';
import { money } from '@/lib/format';
import { nav, pageDescription, pageTitle } from '@/lib/navigation';
import { uploadImageDataUrl } from '@/lib/product-images';
import type { AppNotification, CartItem, Category, Customer, Order, OrderItem, Page, Product } from '@/lib/types';

export function Dashboard({session}:{session:any}){
 const [page,setPage]=useState<Page>('Overview'),[dark,setDark]=useState(false),[mobile,setMobile]=useState(false),[products,setProducts]=useState<Product[]>([]),[categories,setCategories]=useState<Category[]>([]),[customers,setCustomers]=useState<Customer[]>([]),[orders,setOrders]=useState<Order[]>([]),[orderItems,setOrderItems]=useState<OrderItem[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState(''),[modal,setModal]=useState<any>(null),[editing,setEditing]=useState<any>(null),[query,setQuery]=useState(''),[notificationsOpen,setNotificationsOpen]=useState(false),[notificationFilter,setNotificationFilter]=useState<'all'|'unread'|'transactions'|'stock'|'activity'>('all'),[activityNotifications,setActivityNotifications]=useState<AppNotification[]>([]),[readNotificationIds,setReadNotificationIds]=useState<string[]>([]),[notificationFlash,setNotificationFlash]=useState<any>(null),[isFullscreen,setIsFullscreen]=useState(false),[selectedOrder,setSelectedOrder]=useState<Order|null>(null),[selectedNotification,setSelectedNotification]=useState<any>(null),[deleteConfirm,setDeleteConfirm]=useState<any>(null);
 useEffect(()=>{
  if(typeof document==='undefined') return;
  document.body.style.overflow=mobile?'hidden':'';
  return()=>{document.body.style.overflow='';};
 },[mobile]);

 const load=async()=>{
  setLoading(true); setError('');
  try {
   const sessionNow=await ensureFreshSession();
   if(!sessionNow){setError('Sesi login tidak ditemukan. Silakan masuk kembali.');return;}

   // Produk adalah data inti. Modul lain tidak boleh membuat halaman Products ikut mati.
   const productsResult=await runWithAuthRetry(()=>supabase.from('products').select('*').eq('owner_id',sessionNow.user.id).order('created_at',{ascending:false}));
   if(productsResult.error) throw productsResult.error;
   setProducts((productsResult.data||[]) as Product[]);

   // Data pendukung dimuat terpisah dan boleh kosong jika modulnya belum dibuat.
   const [categoriesResult,customersResult,ordersResult,orderItemsResult]=await Promise.all([
    runWithAuthRetry(()=>supabase.from('categories').select('*').eq('owner_id',sessionNow.user.id).order('name')),
    runWithAuthRetry(()=>supabase.from('customers').select('*').eq('owner_id',sessionNow.user.id).order('created_at',{ascending:false})),
    runWithAuthRetry(()=>supabase.from('orders').select('*').eq('owner_id',sessionNow.user.id).order('created_at',{ascending:false}).limit(1000)),
    runWithAuthRetry(()=>supabase.from('order_items').select('*').eq('owner_id',sessionNow.user.id).limit(5000))
   ]);
   const categoryRows=(categoriesResult.data||[]) as Category[];
   const customerRows=(customersResult.data||[]) as Customer[];
   const orderRows=(ordersResult.data||[]) as Order[];
   const orderItemRows=(orderItemsResult.data||[]) as OrderItem[];
   setCategories(categoryRows);
   setCustomers(customerRows);
   const categoryMap=new Map(categoryRows.map(x=>[x.id,x]));
   const customerMap=new Map(customerRows.map(x=>[x.id,x]));
   setProducts(current=>current.map(x=>({...x,categories:x.category_id?categoryMap.get(x.category_id)||null:null})));
   setOrders(orderRows.map(x=>({...x,customers:x.customer_id?customerMap.get(x.customer_id)||null:null})));
   setOrderItems(orderItemRows);

   const optionalErrors=[categoriesResult.error,customersResult.error,ordersResult.error,orderItemsResult.error].filter(Boolean);
   if(optionalErrors.length){
    // Products tetap usable; modul pendukung yang belum siap tidak memblokir CRUD produk.
    console.warn('Mieflow optional modules:', optionalErrors);
   }
  } catch(err:any){setError(friendlySupabaseError(err));}
  finally{setLoading(false);}
 };
 useEffect(()=>{
  const loadNotifications=async()=>{
   try{
    const result=await runWithAuthRetry(()=>supabase.from('notifications').select('*').eq('owner_id',session.user.id).order('created_at',{ascending:false}).limit(100));
    if(result.error){console.warn('Notifications belum tersedia di database:',result.error.message);setActivityNotifications([]);setReadNotificationIds([]);return;}
    const rows=(result.data||[]).map((n:any)=>({id:n.id,type:n.type,title:n.title,detail:n.detail,time:n.created_at?new Date(n.created_at).toLocaleString('id-ID'):'Baru saja',page:n.page as Page,targetId:n.target_id,is_read:n.is_read,created_at:n.created_at}));
    setActivityNotifications(rows);
    setReadNotificationIds(rows.filter((n:any)=>n.is_read).map((n:any)=>n.id));
   }catch(err){console.warn('Gagal memuat notifikasi',err);}
  };
  loadNotifications();
 },[session.user.id]);
 useEffect(()=>{load()},[]);
 useEffect(()=>{
  if(!session?.user?.id) return;
  let active=true;
  const channel=supabase.channel(`mieflow-live-${session.user.id}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:`owner_id=eq.${session.user.id}`},payload=>{
    if(!active)return;
    const row=payload.new as Order;
    if(payload.eventType==='INSERT'||payload.eventType==='UPDATE'){
      const customerRow=row.customer_id?customers.find(c=>c.id===row.customer_id)||null:null;
      setOrders(prev=>{
        const next={...row,customers:customerRow};
        const exists=prev.some(o=>o.id===row.id);
        return exists?prev.map(o=>o.id===row.id?{...o,...next}:o):[next,...prev];
      });
    }else if(payload.eventType==='DELETE'){
      setOrders(prev=>prev.filter(o=>o.id!==payload.old?.id));
      setOrderItems(prev=>prev.filter(i=>i.order_id!==payload.old?.id));
    }
   })
   .on('postgres_changes',{event:'*',schema:'public',table:'order_items',filter:`owner_id=eq.${session.user.id}`},payload=>{
    if(!active)return;
    const row=payload.new as OrderItem;
    if(payload.eventType==='INSERT'){
      setOrderItems(prev=>prev.some(i=>i.id===row.id)?prev:[...prev,row]);
    }else if(payload.eventType==='UPDATE'){
      setOrderItems(prev=>prev.map(i=>i.id===row.id?{...i,...row}:i));
    }else if(payload.eventType==='DELETE'){
      setOrderItems(prev=>prev.filter(i=>i.id!==payload.old?.id));
    }
   })
   .subscribe(status=>{ if(status==='CHANNEL_ERROR'||status==='TIMED_OUT') console.warn('Realtime pelanggan tidak tersedia:',status); });
  return()=>{active=false;supabase.removeChannel(channel);};
 },[session?.user?.id,customers]);
 useEffect(()=>{if(typeof document==='undefined')return;const sync=()=>setIsFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync)},[]);useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),2500);return()=>clearTimeout(t)}},[toast]);useEffect(()=>{if(!notificationFlash)return;const t=setTimeout(()=>setNotificationFlash(null),4500);return()=>clearTimeout(t)},[notificationFlash]);
 const revenue=orders.filter(o=>o.status==='completed').reduce((a,o)=>a+Number(o.total),0),today=new Date().toDateString(),todayOrders=orders.filter(o=>new Date(o.created_at).toDateString()===today&&o.status==='completed');
 const notifications=useMemo(()=>{
   const items:AppNotification[]=[];
   items.push(...activityNotifications.map(n=>({...n,targetId:n.targetId||n.id?.replace(/^order-/,'')})));
   products.filter(p=>p.stock<=0).slice(0,4).forEach(p=>items.push({id:`out-${p.id}`,targetId:p.id,type:'danger',title:'Stok habis',detail:`${p.name} sudah tidak tersedia.`,time:'Perlu tindakan',page:'Inventory'}));
   products.filter(p=>p.stock>0&&p.stock<=5).slice(0,4).forEach(p=>items.push({id:`low-${p.id}`,targetId:p.id,type:'warning',title:'Stok menipis',detail:`${p.name} tersisa ${p.stock} unit.`,time:'Perlu perhatian',page:'Inventory'}));
   orders.filter(o=>o.status==='completed').slice(0,5).forEach(o=>items.push({id:`order-${o.id}`,targetId:o.id,type:'success',title:'Pembayaran berhasil',detail:`#${o.order_number} • ${money(Number(o.total))}`,time:new Date(o.created_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),page:'Orders'}));
   const seen=new Set<string>();
   return items.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true}).sort((a,b)=>String(b.time).localeCompare(String(a.time))).slice(0,15);
 },[products,orders,activityNotifications]);
 const unreadNotifications=notifications.filter(n=>!readNotificationIds.includes(n.id)).length;
 const pushNotification=async(n:any)=>{const draft={type:n.type||'info',title:n.title,detail:n.detail,time:n.time||'Baru saja',page:n.page,targetId:n.targetId||null};setNotificationFlash(draft);setNotificationsOpen(false);try{const r=await runWithAuthRetry(()=>supabase.from('notifications').insert({owner_id:session.user.id,type:draft.type,title:draft.title,detail:draft.detail,page:draft.page,target_id:draft.targetId,is_read:false}).select('*').single());if(r.error)throw r.error;const row=r.data;const item={...draft,id:row.id,is_read:false,created_at:row.created_at,time:new Date(row.created_at).toLocaleString('id-ID')};setActivityNotifications(prev=>[item,...prev].slice(0,100));}catch(err){console.warn('Notifikasi tidak tersimpan ke database:',err);}};
 const markNotificationsRead=async()=>{const ids=notifications.map(n=>n.id);setReadNotificationIds(ids);const customIds=activityNotifications.filter(n=>!n.is_read).map(n=>n.id);if(customIds.length){const r=await runWithAuthRetry(()=>supabase.from('notifications').update({is_read:true}).in('id',customIds).eq('owner_id',session.user.id));if(r.error)console.warn(r.error);setActivityNotifications(prev=>prev.map(n=>({...n,is_read:true})));}};
 const remove=async(table:string,id:string)=>{
   const label=table==='products'?'produk':table==='categories'?'kategori':'pelanggan';
   const item=table==='products'?products.find(x=>x.id===id):table==='customers'?customers.find(x=>x.id===id):categories.find(x=>x.id===id);
   setDeleteConfirm({table,id,label,name:item?.name||label});
 };
 const confirmRemove=async()=>{
   if(!deleteConfirm)return;
   const {table,id,label,name}=deleteConfirm;
   setDeleteConfirm(null);
   try{
    await ensureFreshSession();
    const sessionNow=await ensureFreshSession();
    if(!sessionNow) throw new Error('Sesi login sudah berakhir. Silakan login kembali.');
    const res=await runWithAuthRetry(()=>supabase.from(table).delete().eq('id',id).eq('owner_id',sessionNow.user.id));
    if(res.error)throw res.error;
    // Database memakai ON DELETE SET NULL; state lokal harus mengikuti agar tidak ada label/tab usang sampai refresh.
    if(table==='products'){
     setProducts(items=>items.filter(x=>x.id!==id));
     setOrderItems(items=>items.map(x=>x.product_id===id?{...x,product_id:null}:x));
    }
    if(table==='categories'){
     setCategories(items=>items.filter(x=>x.id!==id));
     setProducts(items=>items.map(x=>x.category_id===id?{...x,category_id:null,categories:null}:x));
    }
    if(table==='customers'){
     setCustomers(items=>items.filter(x=>x.id!==id));
     setOrders(items=>items.map(x=>x.customer_id===id?{...x,customer_id:null,customers:null}:x));
    }
    pushNotification({type:'danger',title:`${label[0].toUpperCase()+label.slice(1)} dihapus`,detail:`${name} berhasil dihapus dari data Mieflow.`,time:'Baru saja',page:table==='products'?'Products':table==='categories'?'Categories':'Customers'});
    setToast(`${label[0].toUpperCase()+label.slice(1)} berhasil dihapus`);
   }catch(err:any){setError(friendlySupabaseError(err))}
 };
 const save=async(type:string,data:any)=>{
  try{
   const sessionNow=await ensureFreshSession();
   if(!sessionNow) throw new Error('Sesi login sudah berakhir. Silakan login kembali.');
   let res:any;
   // Harus dideklarasikan di scope save(), karena dipakai juga setelah cabang product/category/customer.
   // Sebelumnya Categories/Customers memicu ReferenceError: imageWarning is not defined.
   let imageWarning='';
   if(type==='product'){
    const name=String(data.name||'').trim(); const price=Number(data.price); const cost=Number(data.cost||0); const stock=Number(data.stock||0);
    if(name.length<2)throw new Error('Nama produk minimal 2 karakter.');
    if(!Number.isFinite(price)||price<0)throw new Error('Harga jual tidak valid.');
    if(!Number.isFinite(cost)||cost<0)throw new Error('Harga modal tidak valid.');
    if(!Number.isFinite(stock)||stock<0)throw new Error('Stok tidak valid.');
    let imageUrl=data.image_url||null;
    // Jika foto masih berupa preview lokal, upload otomatis saat produk disimpan.
    // Jadi pengguna cukup memilih Gallery lalu menekan Simpan sekali.
    if(typeof imageUrl==='string' && imageUrl.startsWith('data:image/')){
      try{ imageUrl=await uploadImageDataUrl(imageUrl); }
      catch(uploadErr:any){ imageWarning=' Produk tetap disimpan tanpa foto karena Storage belum siap.'; imageUrl=null; console.warn(uploadErr); }
    }
    const payload={owner_id:sessionNow.user.id,name,description:data.description?String(data.description).trim():null,price,cost,stock:Math.floor(stock),image_url:imageUrl,category_id:data.category_id||null,is_active:Boolean(data.is_active)};
    if(editing){
      res=await runWithAuthRetry(()=>supabase.from('products').update(payload).eq('id',editing.id).eq('owner_id',sessionNow.user.id).select('*').single());
    }else{
      res=await runWithAuthRetry(()=>supabase.from('products').insert(payload).select('*').single());
    }
   }else if(type==='category'){
    const categoryName=String(data.name||'').trim();
    if(!categoryName)throw new Error('Nama kategori wajib diisi.');
    const categoryPayload={name:categoryName,color:String(data.color||'#111827'),owner_id:sessionNow.user.id};
    res=editing?await runWithAuthRetry(()=>supabase.from('categories').update(categoryPayload).eq('id',editing.id).eq('owner_id',sessionNow.user.id).select().single()):await runWithAuthRetry(()=>supabase.from('categories').insert(categoryPayload).select().single());
   }else{
    const customerName=String(data.name||'').trim();
    if(!customerName)throw new Error('Nama pelanggan wajib diisi.');
    const customerPayload={name:customerName,phone:data.phone,email:data.email,notes:data.notes,owner_id:sessionNow.user.id};
    res=editing?await runWithAuthRetry(()=>supabase.from('customers').update(customerPayload).eq('id',editing.id).eq('owner_id',sessionNow.user.id).select().single()):await runWithAuthRetry(()=>supabase.from('customers').insert(customerPayload).select().single());
   }
   if(res.error)throw res.error;
   if(type==='product'){
    const saved=res.data as Product;
    // Sinkronkan relasi kategori langsung ke state lokal setelah produk dibuat/diubah.
    // POS menggunakan p.categories?.name untuk membentuk filter kategori.
    // Tanpa ini, produk baru memang tersimpan di Supabase tetapi belum muncul
    // pada kategori di menu Kasir sampai halaman di-refresh.
    const selectedCategory = saved.category_id ? categories.find((c:Category)=>c.id===saved.category_id) || null : null;
    const normalizedSaved: Product = {...saved, categories:selectedCategory};
    setProducts(items=>editing?items.map(x=>x.id===saved.id?normalizedSaved:x):[normalizedSaved,...items]);
   }
   const wasEditing=Boolean(editing);
   const savedName=String(res.data?.name||data.name||'');
   if(!wasEditing) pushNotification({type:'info',title:'Produk ditambahkan',detail:`${savedName} berhasil ditambahkan ke katalog.`,time:'Baru saja',page:'Products'});
   setToast((wasEditing?'Perubahan produk disimpan':'Produk berhasil ditambahkan')+imageWarning);setModal(null);setEditing(null);
   if(type!=='product'){
    const savedName=String(res.data?.name||data.name||'');
    if(type==='category'){
      const savedCategory=res.data as Category;
      setCategories(items=>editing?items.map(x=>x.id===savedCategory.id?savedCategory:x):[...items,savedCategory].sort((a,b)=>a.name.localeCompare(b.name)));
    }
    if(!editing) pushNotification({type:'info',title:type==='category'?'Kategori ditambahkan':'Pelanggan ditambahkan',detail:type==='category'?`${savedName} berhasil ditambahkan ke kategori.`:`${savedName} berhasil ditambahkan ke pelanggan.`,time:'Baru saja',page:type==='category'?'Categories':'Customers'});
    await load();
   }
  }catch(err:any){setError(friendlySupabaseError(err));}
 };
 const go=(p:Page)=>{setPage(p);setQuery('');if(typeof window!=='undefined'&&window.innerWidth<=900)setMobile(false)};
 const openOrder=(order:Order)=>{setSelectedOrder(order);setNotificationsOpen(false);go('Orders')};
 const handleNotificationClick=(n:any)=>{
   // Tetap di halaman saat ini. Detail transaksi dibuka sebagai modal premium.
   setReadNotificationIds(prev=>prev.includes(n.id)?prev:[...prev,n.id]);
   setNotificationsOpen(false);
   setSelectedNotification({...n});
 };
 const searchPlaceholders:any={Overview:'Cari produk, pelanggan, atau transaksi…',POS:'Cari produk untuk kasir…',Orders:'Cari nomor order, pelanggan, atau status…',Analytics:'Cari data analisis…',Products:'Cari produk, kategori, atau stok…',Categories:'Cari kategori…',Customers:'Cari nama, telepon, atau email…',Inventory:'Cari produk atau kategori…',Settings:'Cari pengaturan…'};
 const filteredProducts=products.filter(p=>{const q=query.trim().toLowerCase();const hay=[p.name,p.description||'',p.categories?.name||'',String(p.stock),String(p.price)].join(' ').toLowerCase();return !q||hay.includes(q)});
 const pendingKasirCustomers=useMemo(()=>customers.filter(c=>!isCustomerOrderComplete(c,orders,orderItems,products)),[customers,orders,orderItems,products]);
 const q=query.trim();
 const pageContent=q&&(page==='Overview'||page==='Analytics'||page==='Settings')?<GlobalSearchResults query={q} products={products} customers={customers} categories={categories} orders={orders} go={go} money={money}/>:loading?<div className="loading"><div className="spinner"/> Memuat data toko…</div>:page==='Overview'?<Overview revenue={revenue} orders={todayOrders.length} products={products} allOrders={orders} go={go} money={money}/>:page==='POS'?<POS products={products} categories={categories} customers={pendingKasirCustomers} query={query} onStockChange={(id:string,stock:number)=>setProducts(prev=>prev.map(p=>p.id===id?{...p,stock}:p))} onDone={(receipt:any,soldItems:CartItem[],newOrderItems:OrderItem[]=[])=>{
  // Jangan reload seluruh dashboard setelah pembayaran. Reload membuat layar
  // berkedip/menampilkan "Memuat data toko" dan terasa seperti refresh.
  // Sinkronkan hanya data yang berubah secara lokal: stok dan transaksi baru.
  if(receipt?.id){
   const customerRow=customers.find(c=>c.id===receipt.customer_id)||null;
   setOrders(prev=>[{
    ...receipt,
    owner_id:session.user.id,
    status:'completed',
    payment_method:receipt.payment_method||'cash',
    subtotal:Number(receipt.subtotal??receipt.total??0),
    discount:0,
    total:Number(receipt.total??0),
    amount_paid:Number(receipt.amount_paid??receipt.total??0),
    change_due:Number(receipt.change_due??0),
    created_at:receipt.created_at||new Date().toISOString(),
    customers:customerRow
   },...prev.filter(o=>o.id!==receipt.id)] as Order[]);
  }
  if(Array.isArray(newOrderItems)&&newOrderItems.length){
   setOrderItems(prev=>[...prev.filter(i=>!newOrderItems.some(n=>n.id===i.id)),...newOrderItems]);
  }
  pushNotification({id:receipt?.id?`order-${receipt.id}`:undefined,type:'success',title:'Pembayaran berhasil',detail:`#${receipt?.order_number||'Transaksi'} • ${money(Number(receipt?.total||0))}`,time:'Baru saja',page:'Orders',targetId:receipt?.id||receipt?.order_number});
  setToast('Pembayaran berhasil');
}}/>:page==='Products'?<Products products={filteredProducts} onEdit={(x:any)=>{setEditing(x);setModal('product')}} onDelete={(id:string)=>remove('products',id)}/>:page==='Categories'?<Categories categories={categories} query={query} onEdit={(x:any)=>{setEditing(x);setModal('category')}} onDelete={(id:string)=>remove('categories',id)}/>:page==='Customers'?<Customers customers={customers} orders={orders} orderItems={orderItems} products={products} query={query} onEdit={(x:any)=>{setEditing(x);setModal('customer')}} onDelete={(id:string)=>remove('customers',id)}/>:page==='Orders'?<Orders orders={orders} orderItems={orderItems} query={query} onOpen={openOrder}/>:page==='Inventory'?<Inventory products={products} onError={setError} query={query} onStockChange={(id:string,stock:number)=>setProducts(prev=>prev.map(p=>p.id===id?{...p,stock}:p))} onAdd={()=>{setEditing(null);setModal('product')}} onDelete={(id:string)=>remove('products',id)}/>:page==='Analytics'?<Analytics orders={orders} orderItems={orderItems} products={products} categories={categories}/>:<div className="surface big-empty"><Sparkles size={28}/><h2>{page}</h2><p>Modul ini aman untuk dikembangkan setelah alur POS utama berjalan.</p></div>;

 return <main className={dark?'shell dark':'shell'}><AnimatePresence>{mobile&&<motion.button className="backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setMobile(false)}/>}</AnimatePresence><aside className={mobile?'sidebar open':'sidebar'}><div className="brand"><div className="brand-logo">M</div><div><b>MIEFLOW</b><small>BUSINESS POS</small></div><button className="mobile-close" onClick={()=>setMobile(false)}><X/></button></div><div className="store-card"><span className="live-dot"/><div><b>Warung Mie</b><small>Online • Secure</small></div></div><nav>{nav.map(([label,key,Icon])=><button key={key} className={page===key?'active':''} onClick={()=>go(key)}><Icon size={18}/><span>{label}</span></button>)}</nav><div className="side-bottom"><button onClick={()=>go('Settings')}><Settings size={18}/>Pengaturan</button><button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Keluar</button><div className="user"><div>{(session.user.email||'A')[0].toUpperCase()}</div><span><b>{session.user.email}</b><small>Authenticated</small></span></div></div></aside>
 <section className="main">{notificationFlash&&<AnimatePresence><motion.div className="notification-flash" initial={{opacity:0,y:-18,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-12,scale:.97}} transition={{duration:.22}} role="status"><div className={`notification-flash-icon ${notificationFlash.type}`}>{notificationFlash.type==='danger'?'!':notificationFlash.type==='warning'?'!':notificationFlash.type==='success'?'✓':'i'}</div><div className="notification-flash-copy"><span>{notificationFlash.type==='success'?'PAYMENT CONFIRMED':'NOTIFIKASI BARU'}</span><b>{notificationFlash.title}</b><small>{notificationFlash.detail}</small><button className="notification-flash-action" onClick={()=>setNotificationFlash(null)}>Mengerti <CheckCircle2 size={13}/></button></div><button className="notification-flash-close" onClick={()=>setNotificationFlash(null)} aria-label="Tutup notifikasi"><X size={15}/></button></motion.div></AnimatePresence>}<header className={`${page==='POS'?'topbar pos-topbar':'topbar'}${page==='Overview'?' overview-topbar':''}`}><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb">{page==='POS'?<b>Kasir / POS</b>:<>Workspace <ChevronRight size={14}/><b>{pageTitle(page)}</b></>}</div><div className="top-actions"><label className="global-search universal-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={searchPlaceholders[page]||'Cari data…'} aria-label={`Pencarian ${pageTitle(page)}`}/><button type="button" className="global-search-clear" onClick={()=>setQuery('')} aria-label="Hapus pencarian" style={{display:query?'grid':'none'}}>×</button><kbd>Ctrl /</kbd></label><div className="notification-wrap"><button onClick={()=>setNotificationsOpen(v=>!v)} className="top-icon top-bell" aria-label="Notifikasi"><span>{unreadNotifications>99?"99+":unreadNotifications}</span><Bell size={19}/></button>{notificationsOpen&&<div className="notification-panel"><div className="notification-head"><div><b>Notifikasi</b><small>{notifications.length?`${notifications.length} aktivitas penting`:"Semua aman"}</small></div><button onClick={markNotificationsRead} disabled={!unreadNotifications}>Tandai dibaca</button></div><div className="notification-filters">{[['all','Semua'],['unread','Belum dibaca'],['transactions','Transaksi'],['stock','Stok'],['activity','Aktivitas']].map(([key,label])=><button key={key} className={notificationFilter===key?'active':''} onClick={()=>setNotificationFilter(key as any)}>{label}</button>)}</div><div className="notification-list">{notifications.filter(n=>notificationFilter==='all'||notificationFilter==='unread'?!readNotificationIds.includes(n.id):notificationFilter==='transactions'?n.page==='Orders':notificationFilter==='stock'?n.page==='Inventory':n.page!=='Orders'&&n.page!=='Inventory').map(n=><button key={n.id} className={`notification-item ${readNotificationIds.includes(n.id)?'read':''}`} onClick={()=>handleNotificationClick(n)}><i className={`notification-icon ${n.type}`}>{n.type==='danger'?'!':n.type==='warning'?'!':n.type==='success'?'✓':'i'}</i><span><b>{n.title}</b><small>{n.detail}</small><em>{n.time}</em></span><ChevronRight size={14} className="notification-arrow"/></button>).length?notifications.filter(n=>notificationFilter==='all'||notificationFilter==='unread'?!readNotificationIds.includes(n.id):notificationFilter==='transactions'?n.page==='Orders':notificationFilter==='stock'?n.page==='Inventory':n.page!=='Orders'&&n.page!=='Inventory').map(n=><button key={n.id} className={`notification-item ${readNotificationIds.includes(n.id)?'read':''}`} onClick={()=>handleNotificationClick(n)}><i className={`notification-icon ${n.type}`}>{n.type==='danger'?'!':n.type==='warning'?'!':n.type==='success'?'✓':'i'}</i><span><b>{n.title}</b><small>{n.detail}</small><em>{n.time}</em></span><ChevronRight size={14} className="notification-arrow"/></button>):<div className="notification-empty"><CheckCircle2 size={22}/><b>Tidak ada notifikasi</b><span>Tidak ada aktivitas pada filter ini.</span></div>}</div></div>}</div>{page==='Overview'&&<button className="pos-fullscreen overview-fullscreen" type="button" aria-label={isFullscreen?'Perkecil layar':'Perbesar layar'} title={isFullscreen?'Perkecil layar':'Perbesar layar'} onClick={async()=>{try{if(document.fullscreenElement){await document.exitFullscreen?.()}else{await document.documentElement.requestFullscreen?.()}}catch(e){console.warn('Fullscreen tidak tersedia',e)}}}>{isFullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>}<div className="top-admin"><div className="top-admin-avatar">A</div><div><b>Admin</b><small>Owner</small></div><ChevronDown size={15}/></div></div></header><div className="content">{error&&<div className="error"><span>{error}</span><button onClick={()=>setError('')}><X size={16}/></button></div>}{page==='POS'?<div className="page-title pos-page-title"><div><h1>Kasir</h1><p>Buat pesanan dan kelola transaksi dengan mudah</p></div></div>:<div className="page-title"><div><span className="eyebrow">MIEFLOW / {new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span><h1>{page==='Overview'?'Command Center':pageTitle(page)}</h1><p>{pageDescription(page)}</p></div>{['Products','Categories','Customers'].includes(page)&&<button className="primary" onClick={()=>{setEditing(null);setModal(page==='Products'?'product':page==='Categories'?'category':'customer')}}><Plus size={17}/> Tambah</button>}</div>}{pageContent}</div></section>
 <AnimatePresence>{selectedOrder&&<OrderDetailModal order={selectedOrder} items={orderItems.filter(i=>i.order_id===selectedOrder.id)} onClose={()=>setSelectedOrder(null)} money={money}/>} {modal&&<Modal type={modal} initial={editing} categories={categories} onClose={()=>{setModal(null);setEditing(null)}} onSave={save}/>}</AnimatePresence>{selectedNotification&&<AnimatePresence><motion.div className="notification-detail-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setSelectedNotification(null)}><motion.section className="notification-detail-modal" initial={{opacity:0,y:18,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:.98}} onClick={e=>e.stopPropagation()}><div className={`notification-detail-icon ${selectedNotification.type||'info'}`}>{selectedNotification.type==='success'?'✓':selectedNotification.type==='danger'||selectedNotification.type==='warning'?'!':'i'}</div><button className="notification-detail-close" onClick={()=>setSelectedNotification(null)} aria-label="Tutup detail notifikasi"><X size={18}/></button><span className="notification-detail-eyebrow">{selectedNotification.type==='success'?'TRANSACTION CONFIRMED':'NOTIFICATION DETAIL'}</span><h2>{selectedNotification.title}</h2><p>{selectedNotification.detail}</p><div className="notification-detail-meta"><div><small>WAKTU</small><b>{selectedNotification.time||'Baru saja'}</b></div><div><small>STATUS</small><b>{selectedNotification.type==='success'?'Berhasil':'Tercatat'}</b></div></div><div className="notification-detail-note"><CheckCircle2 size={17}/><span>Notifikasi telah dibuka dan ditandai sebagai sudah dibaca. Anda tetap berada di halaman saat ini.</span></div><button className="notification-detail-action" onClick={()=>setSelectedNotification(null)}>Selesai <Check size={16}/></button></motion.section></motion.div></AnimatePresence>}{deleteConfirm&&<DeleteConfirmDialog data={deleteConfirm} onCancel={()=>setDeleteConfirm(null)} onConfirm={confirmRemove}/>}{toast&&<motion.div className="toast" initial={{y:20,opacity:0}} animate={{y:0,opacity:1}}><Check size={17}/>{toast}</motion.div>}</main>}
