import api from './api';
import {toggleSharedCardLayer} from './sharedCardLayers';
import {addUploadedVectorLayer,removeUploadedVectorLayer} from './uploadedVectorUtils';
jest.mock('./api',()=>({get:jest.fn()}));
jest.mock('./uploadedVectorUtils',()=>({addUploadedVectorLayer:jest.fn(),removeUploadedVectorLayer:jest.fn(),uploadedSourceId:key=>`uploaded-source-${key}`}));
const item={id:7,shared_layer_key:'shared-custom-42'};
const payload={service:{key:'shared-custom-42',label:'Shared'},geojson:{type:'FeatureCollection',features:[]}};
const map=()=>({on:jest.fn(),getSource:jest.fn(()=>null),isStyleLoaded:()=>true});
beforeEach(()=>{jest.clearAllMocks();api.get.mockResolvedValue({data:payload});});

test('reads a public card asset without personal-library credentials and renders under an isolated key',async()=>{
    const target=map();await toggleSharedCardLayer(item,true,target);
    expect(api.get).toHaveBeenCalledWith('/cardArcGISLinks/public-custom-layer/7',{params:{user_email:''}});
    expect(addUploadedVectorLayer).toHaveBeenCalledWith(target,{...payload.service,key:'card-link-7'},payload.geojson,.7);
    await toggleSharedCardLayer(item,false,target);
    expect(removeUploadedVectorLayer).toHaveBeenCalledWith(target,'card-link-7');
    expect(api.get).toHaveBeenCalledTimes(1);
});

test('a slow read cannot redraw a layer after the viewer hides it',async()=>{
    let finish;api.get.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    const target=map(), enabling=toggleSharedCardLayer(item,true,target);
    await Promise.resolve();await Promise.resolve();
    await toggleSharedCardLayer(item,false,target);
    if(finish)finish({data:payload});
    await enabling;
    expect(addUploadedVectorLayer).not.toHaveBeenCalled();
});

test('private or revoked links clear the shared layer and report failure',async()=>{
    api.get.mockRejectedValue({response:{status:404}});
    const target=map();await expect(toggleSharedCardLayer(item,true,target)).rejects.toBeTruthy();
    expect(removeUploadedVectorLayer).toHaveBeenCalledWith(target,'card-link-7');
});

test('an unresolved legacy source never falls back to a viewer personal upload',async()=>{
    await expect(toggleSharedCardLayer({id:7},true,map())).rejects.toThrow(/not ready/);
    expect(api.get).not.toHaveBeenCalled();
    expect(addUploadedVectorLayer).not.toHaveBeenCalled();
});

test('two cards linked to one asset render independent sources',async()=>{
    const target=map();
    await toggleSharedCardLayer(item,true,target);
    await toggleSharedCardLayer({...item,id:8},true,target);
    await toggleSharedCardLayer(item,false,target);
    expect(addUploadedVectorLayer.mock.calls.map(call=>call[1].key)).toEqual(['card-link-7','card-link-8']);
    expect(removeUploadedVectorLayer).toHaveBeenLastCalledWith(target,'card-link-7');
});
