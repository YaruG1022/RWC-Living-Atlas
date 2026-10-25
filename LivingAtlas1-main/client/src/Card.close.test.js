import React from 'react';
import Modal from 'react-modal';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Card from './Card';
import api from './api';
import { fetchAllArcgisServices } from './arcgisServicesDb';
import { fetchUserPreferences } from './userPreferencesApi';

// Keep the real ReactModal to exercise overlay and keyboard close behavior.
jest.mock('./api', () => ({defaults:{baseURL:''},get:jest.fn(),post:jest.fn(),put:jest.fn(),delete:jest.fn()}));
jest.mock('jspdf', () => ({jsPDF:jest.fn()}));
jest.mock('./arcgisDataUtils', () => ({fetchArcgisLegend:jest.fn()}));
jest.mock('./userPreferencesApi', () => ({fetchUserPreferences:jest.fn()}));
jest.mock('./arcgisServicesDb', () => ({fetchAllArcgisServices:jest.fn()}));
jest.mock('./RichTextEditor', () => () => null);
jest.mock('./PolygonDrawingModal', () => () => null);
jest.mock('./CoordinatesPanel', () => () => null);
jest.mock('./ArcGISPickerModal', () => () => null);
jest.mock('./CustomLayerPickerModal', () => () => null);
jest.mock('./OnboardingLearnMore', () => ({__esModule:true,default:({isOpen,onClose})=>isOpen?require('react-dom').createPortal(<button onClick={onClose}>Finish tutorial</button>,global.document.body):null,LEARN_MORE_EDIT_MODE_STEP:0}));

let appRoot, card;
beforeEach(() => {
    jest.clearAllMocks(); localStorage.clear(); localStorage.setItem('email','fixture@example.invalid');
    window.confirm=jest.fn(()=>false); window.alert=jest.fn();
    fetchAllArcgisServices.mockResolvedValue([]); fetchUserPreferences.mockResolvedValue({});
    appRoot=document.createElement('div'); document.body.append(appRoot); Modal.setAppElement(appRoot);
    card={cardID:101,title:'Close fixture',username:'fixture',name:'Fixture',email:'fixture@example.invalid',category:'River',
        latitude:46,longitude:-117,funding:'Original funding',org:'Original organization',is_public:true,images:[],gallery_layout:'multi'};
    api.get.mockImplementation(url=>Promise.resolve({data:url.startsWith('/cardImages/')?{images:[],galleryLayout:'multi'}:url.startsWith('/allCards')?{data:[card]}:{data:[]}}));
    api.post.mockResolvedValue({data:{}}); api.put.mockResolvedValue({data:{}}); api.delete.mockResolvedValue({data:{}});
});
afterEach(async () => { await act(async () => {}); cleanup(); appRoot.remove(); });

async function open(edit=true) {
    render(<Card formData={card} isLoggedIn onCardUpdate={()=>{}} />, {container:appRoot});
    fireEvent.click(appRoot.querySelector('.card'));
    const editButton=await screen.findByRole('button',{name:'Edit project in Learn More modal'});
    if(edit) fireEvent.click(editButton);
    await waitFor(()=>expect(screen.getByRole('dialog')).toBeInTheDocument());
}

function close(via) {
    if(via==='button') fireEvent.click(screen.getByRole('button',{name:'Close learn more modal'}));
    if(via==='overlay') {
        const overlay=document.querySelector('.ModalOverlay--learn-more');
        fireEvent.mouseDown(overlay); fireEvent.mouseUp(overlay); fireEvent.click(overlay);
    }
    if(via==='escape') {
        const input=screen.getByRole('dialog').querySelector('input[name="funding"]');
        input.focus(); fireEvent.keyDown(input,{key:'Escape',code:'Escape',keyCode:27});
    }
}

test.each(['button','overlay','escape'])('closing via %s confirms, keeps edits when declined, and discards only when accepted',async via=>{
    await open();
    const input=screen.getByRole('dialog').querySelector('input[name="funding"]');
    fireEvent.change(input,{target:{value:'Unsaved funding'}});
    close(via);
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Discard them and close?');
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(input.value).toBe('Unsaved funding');
    expect(api.post).not.toHaveBeenCalled();
    window.confirm.mockReturnValue(true); close(via);
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(appRoot.querySelector('.card'));
    fireEvent.click(await screen.findByRole('button',{name:'Edit project in Learn More modal'}));
    expect(screen.getByRole('dialog').querySelector('input[name="funding"]').value).toBe('Original funding');
});

test.each(['org','is_public','filesToUpload'])('%s changes trigger close protection without changing title or other metadata',async field=>{
    await open();
    if(field==='org') fireEvent.change(screen.getByRole('dialog').querySelector('input[name="org"]'),{target:{value:'New organization'}});
    if(field==='is_public') fireEvent.change(screen.getByDisplayValue('Public (visible to everyone)'),{target:{value:'false'}});
    if(field==='filesToUpload') fireEvent.change(screen.getByLabelText('Add files'),{target:{files:[new File(['report'],'report.txt')]}});
    close('button');
    expect(window.confirm).toHaveBeenCalledTimes(1); expect(screen.getByRole('dialog')).toBeInTheDocument();
    if(field==='filesToUpload') expect(screen.getByRole('status')).toHaveTextContent('1 file ready');
});

test.each([false,true])('no confirmation without edits (edit mode: %s)',async edit=>{
    await open(edit); close('button');
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.confirm).not.toHaveBeenCalled();
});

test('restoring a field to its saved value removes the close warning',async()=>{
    await open();
    const input=screen.getByRole('dialog').querySelector('input[name="funding"]');
    fireEvent.change(input,{target:{value:'Temporary'}});
    fireEvent.change(input,{target:{value:'Original funding'}});
    close('overlay'); await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.confirm).not.toHaveBeenCalled();
});

test('closing still protects a draft after a tutorial returns to view mode',async()=>{
    await open(false);
    fireEvent.click(screen.getByRole('button',{name:'Start detail view onboarding'}));
    const input=await waitFor(()=>screen.getByRole('dialog').querySelector('input[name="funding"]'));
    fireEvent.change(input,{target:{value:'Tutorial draft'}});
    fireEvent.click(screen.getByRole('button',{name:'Finish tutorial'}));
    await screen.findByRole('button',{name:'Edit project in Learn More modal'});
    close('button');
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    window.confirm.mockReturnValue(true); close('button');
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
