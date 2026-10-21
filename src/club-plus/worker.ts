import {newPlus} from './store.ts';
import {plusSuggestion} from './suggestion.ts';
self.onmessage=e=>{try{const d=e.data;self.postMessage({result:d.type==='new'?newPlus(d.kind,d.options,d.seed):plusSuggestion(d.session,d.level)});}catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}};
