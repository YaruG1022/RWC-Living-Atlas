import mapboxgl from 'mapbox-gl';
import {showArcgisPopup} from './arcgisPopupUtils';
jest.mock('mapbox-gl',()=>({Popup:jest.fn()}));

test('public upload labels and attributes render as text, including markup and attribute-shaped values',async()=>{
    const element=document.createElement('div');
    const popup={setLngLat:jest.fn().mockReturnThis(),setHTML:jest.fn(html=>{element.innerHTML=html;return popup;}),
        addTo:jest.fn().mockReturnThis(),getElement:()=>element,on:jest.fn()};
    mapboxgl.Popup.mockImplementation(()=>popup);
    await showArcgisPopup({features:[{properties:{OBJECTID:'" data-test="injected','<b>name</b>':'<img src="invalid">'}}],lngLat:{lng:0,lat:0},target:{}},
        {id:'uploaded','name':'<svg>Public upload</svg>'});
    expect(element.querySelector('h3').textContent).toBe('<svg>Public upload</svg>');
    expect(element.querySelector('img')).toBeNull(); expect(element.querySelector('svg')).toBeNull();
    expect(element.querySelector('b')).toBeNull(); expect(element.querySelector('[data-test]')).toBeNull();
    expect(element.textContent).toContain('<img src="invalid">');
});
