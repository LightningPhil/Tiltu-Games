export interface PlusUI {selected:number|null;cards:number[];hint:number[];notice:string;thinking:boolean;busy:boolean;zoom:boolean;notes:boolean;towers:boolean;wordFrom:number|null;wordPreview:number[];outline:number|null;bid:number;hintEntry:{at:number;value:number;reason:string}|null;loading:boolean}
export interface PlusView {board:string;settings?:string;title?:string;detail?:string;stats?:string}
export const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export const action=(id:string,label:string,disabled=false,primary=false)=>`<button class="button ${primary?'primary':''}" data-plus="${id}" ${disabled?'disabled':''}>${label}</button>`;
export const option=(value:string|number,label:string,selected:string|number)=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`;
export const SEATS=['You','West','North','East'];
export const tinyTime=(n:number)=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
