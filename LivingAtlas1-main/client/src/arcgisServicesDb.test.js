import api from './api';
import { fetchCustomFolders, fetchCustomLayers, saveCustomLayer } from './arcgisServicesDb';
import { customLayerErrorMessage } from './customLayerErrors';
jest.mock('./api', () => ({ get: jest.fn(), post: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test('save preserves backend recovery instructions and error metadata', async () => {
    const error = Object.assign(new Error('Request failed with status code 503'), {
        response: {status:503,data:{detail:'The layer library is temporarily unavailable. Please try again shortly.'}},
    });
    api.post.mockRejectedValue(error);
    await expect(saveCustomLayer('probe@example.invalid', {key:'probe',label:'Probe',url:'/MapServer'}))
        .rejects.toMatchObject({message:error.response.data.detail,response:{status:503}});
});

test.each([fetchCustomLayers, fetchCustomFolders])('failed library reads reject instead of masquerading as an empty library', async fetch => {
    api.get.mockRejectedValue({response:{status:500,data:{detail:'Could not load the library. Please try again.'}}});
    await expect(fetch('probe@example.invalid')).rejects.toMatchObject({message:'Could not load the library. Please try again.'});
});

test('successful empty library and folders remain valid empty results', async () => {
    api.get.mockResolvedValue({data:[]});
    await expect(fetchCustomLayers('probe@example.invalid')).resolves.toEqual([]);
    await expect(fetchCustomFolders('probe@example.invalid')).resolves.toEqual([]);
});

test('timeout explains an uncertain save, network errors give recovery steps, and validation identifies fields', () => {
    expect(customLayerErrorMessage({code:'ECONNABORTED'}, undefined, {saving:true})).toMatch(/may have completed/);
    expect(customLayerErrorMessage({code:'ECONNABORTED'})).toMatch(/Loading the layer library timed out/);
    expect(customLayerErrorMessage({code:'ERR_NETWORK'})).toMatch(/Check your connection/);
    expect(customLayerErrorMessage({response:{data:{detail:[{loc:['body','service_key'],msg:'required'}]}}})).toMatch(/service_key/);
});
