"use client";
import { useEffect, useRef, useState } from "react";
import { actions } from "@/lib/store";
import type { OfficeState } from "@/lib/types";
import { X } from "./icons";

export function TopicPicker({s,onClose}:{s:OfficeState;onClose:()=>void}) {
  const topics=s.rooms.filter(r=>r.telegram);
  const [picked,setPicked]=useState<string[]>(s.visibleTopicIds ?? topics.map(r=>r.telegram!.topicId));
  const [query,setQuery]=useState("");
  const dialog=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const before=document.activeElement as HTMLElement|null;
    dialog.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    return ()=>before?.focus();
  },[]);
  const filtered=topics.filter(r=>`${r.name} ${r.telegram!.topicId}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#16171d]/30 p-4 backdrop-blur-sm" onClick={onClose}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="topic-picker-title" dir="rtl" className="flex max-h-[85dvh] w-full max-w-[560px] flex-col rounded-[22px] bg-white p-5 text-[#1d1f26] shadow-2xl" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
      if(e.key==="Escape")onClose();
      if(e.key==="Tab"){
        const nodes=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');
        if(nodes?.length){const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}}
      }
    }}>
      <header className="flex items-center justify-between gap-3">
        <h2 id="topic-picker-title" className="text-[18px] font-semibold">انتخاب تاپیک ها</h2>
        <button onClick={onClose} aria-label="بستن انتخاب تاپیک ها" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#f4f5f8]"><X/></button>
      </header>
      <p className="mt-2 text-[12px] leading-6 text-[#656a76]">هر کاراکتر نمایندهٔ یک تاپیک است. تاپیک های انتخاب شده در دفتر و فهرست اتاق ها نمایش داده می شوند؛ هیچ پیام یا تاپیکی حذف نمی شود.</p>
      <input type="search" aria-label="جستجوی تاپیک" value={query} onChange={e=>setQuery(e.target.value)} placeholder="جستجوی نام یا شمارهٔ تاپیک…" className="mt-4 min-h-11 w-full rounded-xl border border-[#dce1eb] px-3 text-[14px] outline-none focus:border-[#4f7cf5]"/>
      <div className="my-3 flex items-center gap-2 text-[12px]">
        <button onClick={()=>setPicked(topics.map(r=>r.telegram!.topicId))} className="min-h-10 rounded-lg border border-[#dce1eb] px-3">انتخاب همه</button>
        <button onClick={()=>setPicked([])} className="min-h-10 rounded-lg border border-[#dce1eb] px-3">هیچ کدام</button>
        <span className="mr-auto">{picked.length} از {topics.length} تاپیک</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {filtered.map(r=>{const id=r.telegram!.topicId;return <label key={id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-[#f4f6fb]">
          <input type="checkbox" data-topic-choice={id} aria-label={r.name} checked={picked.includes(id)} onChange={e=>setPicked(old=>e.target.checked?[...old,id]:old.filter(x=>x!==id))} className="h-5 w-5 shrink-0 accent-[#315edf]"/>
          <span className="min-w-0 flex-1"><span className="block break-words text-[14px] font-medium">{r.name}</span><span className="text-[11px] text-[#79808c]">تاپیک {id}</span></span>
        </label>;})}
        {!filtered.length && <p className="py-8 text-center text-[13px] text-[#79808c]">تاپیکی پیدا نشد.</p>}
      </div>
      <footer className="mt-4 border-t border-[#edf0f5] pt-3">
        <p className="mb-3 text-[11px] text-[#79808c]">انتخاب شما در همین مرورگر ذخیره می شود.</p>
        <div className="flex gap-2">
          <button onClick={()=>{actions.setTopicVisibility(picked);onClose();}} className="min-h-11 flex-1 rounded-xl bg-[#1f4fd6] px-4 text-[14px] font-semibold text-white">ذخیرهٔ انتخاب</button>
          <button onClick={onClose} className="min-h-11 rounded-xl border border-[#dce1eb] px-4 text-[14px]">انصراف</button>
        </div>
      </footer>
    </div>
  </div>;
}
