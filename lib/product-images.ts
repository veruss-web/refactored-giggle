/** Product photo upload to the Supabase Storage bucket `product-images` (scoped to the signed-in user). */
import { ensureFreshSession, runWithAuthRetry, supabase } from '@/lib/supabase';

export async function uploadImageDataUrl(dataUrl:string){
 const response=await fetch(dataUrl);
 const blob=await response.blob();
 const userId=(await ensureFreshSession())?.user.id;
 if(!userId) throw new Error('Sesi login tidak ditemukan.');
 const path=`${userId}/products/${crypto.randomUUID()}.webp`;
 const result=await runWithAuthRetry(()=>supabase.storage.from('product-images').upload(path,blob,{contentType:'image/webp',upsert:false,cacheControl:'3600'}));
 if(result.error) throw result.error;
 const publicUrl=supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
 if(!publicUrl) throw new Error('URL foto tidak tersedia.');
 return publicUrl;
}
