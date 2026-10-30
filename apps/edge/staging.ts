import {handleEdge} from './worker';

// Private validation artifact, without assets, upstream credentials or user data.
export default {
    fetch(request: Request) {
        return handleEdge(request, {ASSETS:{fetch:async()=>Response.json(
            {status:'preparing',message:'Forma beta em preparação; backend central e mídia ainda indisponíveis.'},
            {status:503,headers:{'Cache-Control':'no-store'}}
        )}});
    }
};
