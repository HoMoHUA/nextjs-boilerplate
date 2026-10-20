import {notFound} from 'next/navigation';
import {StudioInteractionPreview} from '@/components/office/StudioInteractionPreview';
export const dynamic='force-dynamic';
/** Disabled by default, and still behind the site's existing authentication proxy. */
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 if(process.env.STUDIO_PREVIEW_ENABLED!=='1')notFound();
 const params=await searchParams,pose=['press','brew','sip','replace'].includes(String(params.pose))?String(params.pose):'sip';
 const build=['compact','tall'].includes(String(params.build))?String(params.build):'average';
 return <StudioInteractionPreview pose={pose as 'press'|'brew'|'sip'|'replace'} build={build as 'compact'|'average'|'tall'}/>;
}
