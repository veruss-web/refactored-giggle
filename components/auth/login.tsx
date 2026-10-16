'use client';

/** Authentication screens: sign in / sign up and the missing-configuration notice. */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function ConfigError(){return <div className="auth-screen"><div className="login-card"><div className="brand-logo big">M</div><span className="eyebrow">MIEFLOW POS</span><h1>Konfigurasi belum lengkap</h1><p>Deployment Vercel berhasil dibuat, tetapi environment variable Supabase belum dipasang. Tambahkan <b>NEXT_PUBLIC_SUPABASE_URL</b> dan <b>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</b> di Vercel, lalu lakukan redeploy.</p><div className="error">Vercel → Project → Settings → Environment Variables</div></div></div>}

export function Login(){
 const [mode,setMode]=useState<'login'|'signup'>('login');
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [signedUp,setSignedUp]=useState(false);
 const passwordScore=[password.length>=8,/\d/.test(password),/[A-Z]/.test(password),/[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
 const submit=async(e:any)=>{
  e.preventDefault();setLoading(true);setError('');setSuccess('');
  if(mode==='signup'){
   if(name.trim().length<2){setError('Nama minimal 2 karakter.');setLoading(false);return}
   if(password.length<8){setError('Password minimal 8 karakter.');setLoading(false);return}
   if(password!==confirm){setError('Konfirmasi password belum sama.');setLoading(false);return}
   const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:name.trim(),role:'cashier'}}});
   if(error)setError(error.message);
   else if(data.session){setSuccess('Akun berhasil dibuat. Selamat datang di Mieflow.');}
   else {setSignedUp(true);setSuccess('Akun berhasil dibuat. Cek email untuk konfirmasi sebelum masuk.');}
  }else{
   const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
   if(error)setError(error.message);
   else if(!data.session)setError('Login berhasil tetapi sesi belum tersedia. Coba masuk lagi.');
  }
  setLoading(false);
 };
 const switchMode=(next:'login'|'signup')=>{setMode(next);setError('');setSuccess('');setSignedUp(false);setPassword('');setConfirm('')};
 if(signedUp)return <div className="auth-screen auth-modern"><div className="auth-glow glow-one"/><div className="auth-glow glow-two"/><div className="auth-layout"><AuthBrand/><motion.div className="auth-panel success-panel" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}}><div className="success-icon"><CheckCircle2 size={32}/></div><span className="eyebrow">AKUN SIAP</span><h1>Konfirmasi email</h1><p>Kami sudah mengirim email konfirmasi ke <b>{email}</b>. Buka email tersebut, lalu kembali ke Mieflow untuk masuk.</p><div className="info-card"><Mail size={18}/><div><b>Belum menerima email?</b><small>Periksa folder Spam/Promosi atau tunggu beberapa menit.</small></div></div><button className="primary wide" onClick={()=>switchMode('login')}>Kembali ke halaman masuk <ArrowRight size={17}/></button></motion.div></div></div>;
 return <div className="auth-screen auth-modern"><div className="auth-glow glow-one"/><div className="auth-glow glow-two"/><div className="auth-layout"><AuthBrand/><motion.form className="auth-panel" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.35}} onSubmit={submit}>
   <div className="auth-panel-head"><div><span className="eyebrow">MIEFLOW POS</span><h1>{mode==='login'?'Selamat datang kembali':'Buat akun baru'}</h1><p>{mode==='login'?'Masuk untuk mengelola toko dan transaksi.':'Daftarkan email untuk akses Admin/Kasir.'}</p></div><div className="secure-badge"><ShieldCheck size={15}/> Secure</div></div>
   <div className="auth-tabs"><button type="button" className={mode==='login'?'active':''} onClick={()=>switchMode('login')}>Masuk</button><button type="button" className={mode==='signup'?'active':''} onClick={()=>switchMode('signup')}>Daftar akun</button></div>
   {error&&<div className="error auth-error"><span>{error}</span></div>}{success&&<div className="success-banner"><CheckCircle2 size={17}/><span>{success}</span></div>}
   {mode==='signup'&&<AuthField icon={UserRound} label="Nama lengkap" value={name} onChange={setName} placeholder="Contoh: Budi Santoso" required/>}
   <AuthField icon={Mail} label="Email" type="email" value={email} onChange={setEmail} placeholder="nama@contoh.com" required/>
   <AuthField icon={LockKeyhole} label="Password" type={showPassword?'text':'password'} value={password} onChange={setPassword} placeholder={mode==='signup'?'Minimal 8 karakter':'Masukkan password'} required trailing={<button type="button" className="field-action" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Sembunyikan password':'Tampilkan password'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button>}/>
   {mode==='signup'&&<><div className="password-meter"><div><span>Kekuatan password</span><b>{passwordScore<2?'Lemah':passwordScore<4?'Sedang':'Kuat'}</b></div><i><em style={{width:`${Math.max(8,passwordScore*25)}%`}}/></i><small>Gunakan 8+ karakter, angka, huruf besar, dan simbol.</small></div><AuthField icon={LockKeyhole} label="Ulangi password" type={showPassword?'text':'password'} value={confirm} onChange={setConfirm} placeholder="Ketik ulang password" required/></>}
   {mode==='login'&&<div className="auth-options"><span>Gunakan akun Supabase terdaftar</span><button type="button" onClick={()=>{setMode('signup');setError('')}}>Belum punya akun?</button></div>}
   {mode==='signup'&&<label className="terms"><input type="checkbox" required/> <span>Saya setuju akun ini digunakan untuk operasional Mieflow.</span></label>}
   <button className="auth-submit" disabled={loading}>{loading?<><span className="mini-spinner"/> Memproses…</>:mode==='login'?<>Masuk ke dashboard <ArrowRight size={17}/></>:<>Buat akun Mieflow <ArrowRight size={17}/></>}</button>
   <div className="auth-foot"><span>🔒 Data autentikasi diamankan oleh Supabase</span></div>
 </motion.form></div></div>
}

export function AuthBrand(){return <div className="auth-brand"><div className="brand-logo auth-logo">M</div><span className="eyebrow light">BUSINESS POS</span><h2>Operasional toko,<br/><em>lebih rapi.</em></h2><p>Kelola penjualan, stok, pelanggan, dan transaksi dalam satu dashboard yang cepat dan modern.</p><div className="auth-points"><div><CheckCircle2 size={17}/><span>Kasir terpusat & real-time</span></div><div><CheckCircle2 size={17}/><span>Inventory lebih mudah dipantau</span></div><div><CheckCircle2 size={17}/><span>Akses aman berbasis akun</span></div></div><small className="auth-version">MIEFLOW • BUSINESS POS</small></div>}

export function AuthField({icon:Icon,label,value,onChange,type='text',placeholder='',required=false,trailing}:any){return <label className="auth-field"><span>{label}</span><div><Icon size={17}/><input required={required} type={type} value={value??''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{trailing}</div></label>}
