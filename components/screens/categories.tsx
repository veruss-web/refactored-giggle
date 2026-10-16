'use client';

/** Category management. */
import { Tags } from 'lucide-react';
import { Actions, Head, TableHead } from '@/components/shared/primitives';
import type { Category } from '@/lib/types';

export function Categories({categories,query,onEdit,onDelete}:any){const q=(query||'').trim().toLowerCase();const filtered=categories.filter((c:Category)=>!q||c.name.toLowerCase().includes(q)||c.color.toLowerCase().includes(q));return <div className="surface table-surface"><Head title="Kategori" icon={Tags}/><TableHead cols={['Nama','Warna','Dibuat','']}/>{filtered.map((c:Category)=><div className="row category-row" key={c.id}><div><span className="color-dot" style={{background:c.color}}/><b>{c.name}</b></div><code>{c.color}</code><span>{c.created_at?new Date(c.created_at).toLocaleDateString('id-ID'):'—'}</span><Actions onEdit={()=>onEdit(c)} onDelete={()=>onDelete(c.id)}/></div>)}</div>}
