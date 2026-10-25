import api from './api';
import {resolveLinkedLayerVisibility,saveLinkedLayerVisibility} from './linkedLayerVisibility';
jest.mock('./api',()=>({patch:jest.fn()}));
beforeEach(()=>{localStorage.clear();jest.clearAllMocks();api.patch.mockResolvedValue({data:{success:true}});});

test('guest choices survive reloads and stay separate from account choices',async()=>{
    const items=[{id:7,is_visible:false},{id:8,is_visible:true}];
    await saveLinkedLayerVisibility(items[0],true,'');
    expect(resolveLinkedLayerVisibility(items,'').map(item=>item.is_visible)).toEqual([true,false]);
    expect(resolveLinkedLayerVisibility(items,'account@example.invalid')).toEqual(items);
    expect(api.patch).not.toHaveBeenCalled();
});

test('malformed guest storage falls back to hidden',()=>{
    localStorage.setItem('atlas_guest_linked_layer_visibility_v1','broken');
    expect(resolveLinkedLayerVisibility([{id:7,is_visible:true}],'')[0].is_visible).toBe(false);
});

test('rapid changes are sent in order while another account has an independent queue',async()=>{
    let finish;
    api.patch.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const first=saveLinkedLayerVisibility({id:7},true,'one@example.invalid');
    const next=saveLinkedLayerVisibility({id:7},false,'one@example.invalid');
    const other=saveLinkedLayerVisibility({id:7},false,'two@example.invalid');
    await other;
    expect(api.patch.mock.calls.map(call=>call[1])).toEqual([
        {is_visible:true,requester_email:'one@example.invalid'},
        {is_visible:false,requester_email:'two@example.invalid'},
    ]);
    finish({data:{success:true}});await first;await next;
    expect(api.patch).toHaveBeenLastCalledWith('/cardArcGISLinks/7',{is_visible:false,requester_email:'one@example.invalid'});
});

test('a failed write does not block the next personal setting',async()=>{
    api.patch.mockRejectedValueOnce(new Error('Offline'));
    const first=saveLinkedLayerVisibility({id:8},true,'one@example.invalid');
    const next=saveLinkedLayerVisibility({id:8},false,'one@example.invalid');
    await expect(first).rejects.toThrow('Offline');await next;
    expect(api.patch).toHaveBeenCalledTimes(2);
});
