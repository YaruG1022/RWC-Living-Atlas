import { hasCardLocationEdits, isCardLocationEditing, setCardLocationEditing, syncCardLocationEditing } from './cardLocationEditing';

afterEach(() => { setCardLocationEditing(101, false); document.body.innerHTML = ''; });

test('editing closes the card popup and identifies the card until cleanup', () => {
    const popup = document.createElement('div');
    popup.className = 'card-pin-rich-popup';
    const close = document.createElement('button');
    close.className = 'mapboxgl-popup-close-button';
    const onClose = jest.fn();
    close.onclick = onClose;
    popup.append(close); document.body.append(popup);
    setCardLocationEditing(101, true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(isCardLocationEditing('101')).toBe(true);
    expect(hasCardLocationEdits()).toBe(true);
    setCardLocationEditing(101, false);
    expect(hasCardLocationEdits()).toBe(false);
});

test('hides every old representation, including recreated markers and hit/hover layers, then restores prior visibility', () => {
    const ids = ['card-polygon-fill-101','card-polygon-line-101-dashed','card-polygon-hover-101','card-image-layer-101','card-image-outline-101','card-image-hit-101','card-image-hover-101'];
    const visibility = Object.fromEntries(ids.map(id => [id, id.includes('hover') ? 'none' : 'visible']));
    const map = {
        getStyle: () => ({layers:[...ids,'card-polygon-fill-102','unrelated'].map(id => ({id}))}),
        getLayoutProperty: id => visibility[id],
        setLayoutProperty: jest.fn((id, prop, value) => { visibility[id] = value; }),
    };
    const element = document.createElement('div'); element.dataset.cardMarkerId = '101';
    const other = document.createElement('div'); other.dataset.cardMarkerId = '102';
    setCardLocationEditing(101, true);
    syncCardLocationEditing(map,[{getElement:()=>element},{getElement:()=>other}]);
    expect(element.dataset.cardLocationEditing).toBe('true');
    expect(other.dataset.cardLocationEditing).toBeUndefined();
    expect(ids.every(id => visibility[id] === 'none')).toBe(true);
    const replacement = document.createElement('div'); replacement.dataset.cardMarkerId = '101';
    syncCardLocationEditing(map,[{getElement:()=>replacement}]);
    expect(replacement.dataset.cardLocationEditing).toBe('true');
    setCardLocationEditing(101, false);
    syncCardLocationEditing(map,[{getElement:()=>element}]);
    expect(element.dataset.cardLocationEditing).toBeUndefined();
    expect(visibility['card-polygon-fill-101']).toBe('visible');
    expect(visibility['card-image-hover-101']).toBe('none');
    expect(map.setLayoutProperty.mock.calls.every(([id]) => ids.includes(id))).toBe(true);
});

test('ending an edit respects the global hidden state', () => {
    let visibility = 'visible';
    const map = {getStyle:()=>({layers:[{id:'card-image-layer-101'}]}),getLayoutProperty:()=>visibility,
        setLayoutProperty: (id, prop, value) => { visibility=value; }};
    setCardLocationEditing(101,true); syncCardLocationEditing(map,[]);
    setCardLocationEditing(101,false); syncCardLocationEditing(map,[],false);
    expect(visibility).toBe('none');
});
