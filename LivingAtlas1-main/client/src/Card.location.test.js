import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Card from './Card';
import api from './api';
import { fetchAllArcgisServices } from './arcgisServicesDb';
import { fetchUserPreferences } from './userPreferencesApi';
import { CARD_LOCATION_EDIT_EVENT, isCardLocationEditing, syncCardLocationEditing } from './cardLocationEditing';

jest.mock('./api', () => ({ defaults:{baseURL:''}, get:jest.fn(), post:jest.fn(), put:jest.fn(), delete:jest.fn() }));
jest.mock('jspdf', () => ({jsPDF:jest.fn()}));
jest.mock('./arcgisDataUtils', () => ({fetchArcgisLegend:jest.fn()}));
jest.mock('./userPreferencesApi', () => ({fetchUserPreferences:jest.fn().mockResolvedValue({})}));
jest.mock('./arcgisServicesDb', () => ({fetchAllArcgisServices:jest.fn().mockResolvedValue([])}));
jest.mock('./RichTextEditor', () => () => null);
jest.mock('./ArcGISPickerModal', () => () => null);
jest.mock('./CustomLayerPickerModal', () => () => null);
jest.mock('./OnboardingLearnMore', () => ({__esModule:true,default:()=>null,LEARN_MORE_EDIT_MODE_STEP:0}));
jest.mock('react-modal', () => ({__esModule:true,default:({isOpen,children})=>isOpen?<div role="dialog">{children}</div>:null}));
jest.mock('./CoordinatesPanel', () => ({initialPoints,onSave,onCancel}) => <div data-testid="point-editor" data-points={JSON.stringify(initialPoints)}>
    <button onClick={()=>onSave([{lat:48,lng:-120,icon:'pin',color:'#123456',opacity:.7}])}>Use point</button>
    <button onClick={()=>onSave([{lat:48,lng:-120},{lat:49,lng:-121}])}>Use multiple points</button>
    <button onClick={onCancel}>Cancel location editor</button>
</div>);
jest.mock('./PolygonDrawingModal', () => ({mode,initialVertices,onSave,onCancel}) => <div data-testid="shape-editor" data-mode={mode} data-vertices={JSON.stringify(initialVertices)}>
    <button onClick={()=>{
        const vertices=[{lat:48,lng:-120},{lat:49,lng:-120},{lat:49,lng:-119},{lat:48,lng:-119}];
        onSave(mode==='image'?vertices:[vertices],{lat:48.5,lng:-119.5},{fillColor:'#123456'},mode==='image'?[{file:new File(['image'],'overlay.png',{type:'image/png'}),url:'data:image/png;base64,AA=='}]:[]);
    }}>Use shape</button>
    <button onClick={onCancel}>Cancel location editor</button>
</div>);

const vertices=[{lat:46,lng:-117},{lat:47,lng:-117},{lat:47,lng:-116},{lat:46,lng:-116}];
let card, marker, other, map, visibility, sync;
beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear(); localStorage.setItem('email','fixture@example.invalid');
    fetchAllArcgisServices.mockResolvedValue([]); fetchUserPreferences.mockResolvedValue({});
    window.alert=jest.fn(); window.confirm=jest.fn(()=>true);
    card={cardID:101,title:'Location fixture',username:'fixture',name:'Fixture',email:'fixture@example.invalid',category:'River',latitude:46,longitude:-117,
        location_type:'point',polygon_vertices:vertices,images:[],thumbnail_link:'/old-overlay.png'};
    api.get.mockImplementation(url=>Promise.resolve({data:url.startsWith('/cardImages/')?{images:[]}:url.startsWith('/allCards')?{data:[card]}:{data:[]}}));
    api.post.mockImplementation((url, body)=>{
        if(url==='/uploadForm') card={...card,location_type:body.get('location_type'),latitude:Number(body.get('latitude')),longitude:Number(body.get('longitude'))};
        return Promise.resolve({data:{}});
    });
    api.put.mockResolvedValue({data:{}}); api.delete.mockResolvedValue({data:{}});
    marker=document.createElement('div'); marker.dataset.cardMarkerId='101'; document.body.append(marker);
    other=document.createElement('div'); other.dataset.cardMarkerId='102'; document.body.append(other);
    visibility={'card-polygon-fill-101':'visible','card-image-layer-101':'visible','card-image-hit-101':'visible'};
    map={flyTo:jest.fn(),fitBounds:jest.fn(),getStyle:()=>({layers:Object.keys(visibility).map(id=>({id}))}),getLayoutProperty:id=>visibility[id],
        setLayoutProperty:jest.fn((id,property,value)=>{visibility[id]=value;})};
    window.atlasMapInstance=map;
    sync=()=>syncCardLocationEditing(map,[{getElement:()=>marker},{getElement:()=>other}]);
    window.addEventListener(CARD_LOCATION_EDIT_EVENT,sync);
});
afterEach(() => {
    cleanup(); window.removeEventListener(CARD_LOCATION_EDIT_EVENT,sync);
    marker.remove(); other.remove(); delete window.atlasMapInstance;
});

async function edit(type) {
    card.location_type=type;
    const view=render(<Card formData={card} isLoggedIn onCardUpdate={()=>{}} />);
    fireEvent.click(view.container.querySelector('.card'));
    fireEvent.click(await screen.findByRole('button',{name:'Edit project in Learn More modal'}));
    await screen.findByRole('button',{name:'Change location type'});
    return view;
}
const menu=()=>fireEvent.click(screen.getByRole('button',{name:'Change location type'}));
const choose=type=>{ menu(); fireEvent.click(screen.getByRole('button',{name:type,exact:true})); };

test.each(['point','multipoint','polygon','image'])('%s offers all types with the current type disabled',async type=>{
    await edit(type); menu();
    const current=type==='multipoint'?'Point':type[0].toUpperCase()+type.slice(1);
    expect(screen.getByRole('button',{name:current,exact:true})).toBeDisabled();
    fireEvent.mouseOver(screen.getByRole('button',{name:current,exact:true}));
    fireEvent.click(screen.getByRole('button',{name:current,exact:true}));
    expect(map.flyTo).not.toHaveBeenCalled();
    expect(screen.queryByTestId('point-editor')).toBeNull(); expect(screen.queryByTestId('shape-editor')).toBeNull();
    for(const name of ['Point','Polygon','Image'].filter(name=>name!==current)) expect(screen.getByRole('button',{name,exact:true})).toBeEnabled();
});

const transitions=[['point','Polygon'],['point','Image'],['polygon','Point'],['polygon','Image'],['image','Point'],['image','Polygon']];
test.each(transitions)('%s to %s starts blank, closes popups and hides only this card; cancel restores the original',async(source,target)=>{
    await edit(source);
    const popup=document.createElement('div'); popup.className='card-pin-rich-popup';
    const close=document.createElement('button'); close.className='mapboxgl-popup-close-button'; close.onclick=()=>popup.remove(); popup.append(close); document.body.append(popup);
    choose(target);
    const editor=screen.getByTestId(target==='Point'?'point-editor':'shape-editor');
    expect(JSON.parse(editor.getAttribute(target==='Point'?'data-points':'data-vertices'))).toEqual([]);
    if(target!=='Point') expect(editor.getAttribute('data-mode')).toBe(target.toLowerCase());
    expect(document.querySelector('.card-pin-rich-popup')).toBeNull();
    expect(isCardLocationEditing(101)).toBe(true); expect(marker.dataset.cardLocationEditing).toBe('true');
    expect(other.dataset.cardLocationEditing).toBeUndefined();
    expect(Object.values(visibility).every(value=>value==='none')).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Cancel location editor'}));
    await screen.findByRole('button',{name:'Change location type'}); menu();
    const label=source[0].toUpperCase()+source.slice(1);
    expect(screen.getByRole('button',{name:label,exact:true})).toBeDisabled();
    expect(isCardLocationEditing(101)).toBe(false); expect(marker.dataset.cardLocationEditing).toBeUndefined();
    expect(Object.values(visibility).every(value=>value==='visible')).toBe(true);
});

test.each(transitions)('%s to %s persists the accepted type and geometry only after main Save',async(source,target)=>{
    await edit(source); choose(target);
    fireEvent.click(screen.getByRole('button',{name:target==='Point'?'Use point':'Use shape'}));
    expect(api.post).not.toHaveBeenCalled(); expect(isCardLocationEditing(101)).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Save',exact:true}));
    await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/uploadForm',expect.any(FormData)));
    const body=api.post.mock.calls.find(([url])=>url==='/uploadForm')[1];
    expect(body.get('location_type')).toBe(target.toLowerCase());
    if(target==='Point') { expect(body.get('polygon_coordinates')).toBeNull(); expect(body.get('latitude')).toBe('48.000000'); }
    else expect(body.get('polygon_coordinates')).toContain('48');
    if(target==='Image') expect(body.get('thumbnail').name).toBe('overlay.png');
    await waitFor(()=>expect(isCardLocationEditing(101)).toBe(false));
});

test('discarding a completed conversion restores the original and never uploads the selected image',async()=>{
    await edit('polygon'); choose('Image'); fireEvent.click(screen.getByRole('button',{name:'Use shape'}));
    fireEvent.click(screen.getByRole('button',{name:'Cancel',exact:true}));
    await waitFor(()=>expect(isCardLocationEditing(101)).toBe(false));
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Edit project in Learn More modal'})); menu();
    expect(screen.getByRole('button',{name:'Polygon',exact:true})).toBeDisabled();
});

test('an overlay can become multiple points without retaining its old polygon geometry',async()=>{
    await edit('image'); choose('Point'); fireEvent.click(screen.getByRole('button',{name:'Use multiple points'}));
    fireEvent.click(screen.getByRole('button',{name:'Save',exact:true}));
    await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/uploadForm',expect.any(FormData)));
    const body=api.post.mock.calls.find(([url])=>url==='/uploadForm')[1];
    expect(body.get('location_type')).toBe('multipoint'); expect(body.get('polygon_coordinates')).toBeNull();
    expect(JSON.parse(body.get('multipoint_coordinates'))).toHaveLength(2);
});
