'use client';

import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { ConfigError, Login } from '@/components/auth/login';
import { Dashboard } from '@/components/dashboard/dashboard';

export default function Home(){
 const [session,setSession]=useState<any>(null),[authLoading,setAuthLoading]=useState(true);
 useEffect(()=>{
  if(!isSupabaseConfigured){setAuthLoading(false);return;}
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthLoading(false)});
  const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
  return()=>data.subscription.unsubscribe();
 },[]);
 if(!isSupabaseConfigured)return <ConfigError/>;
 if(authLoading)return <div className="auth-screen"><div className="spinner"/> Memuat Mieflow…</div>;
 if(!session)return <Login/>;
 return <Dashboard session={session}/>;
}
