export const LINE_DASHES = { solid: undefined, dashed: '8 6', dotted: '2 4', dashdot: '8 4 2 4' };
export const validCoordinate = point => point && point.lat != null && point.lng != null && point.lat !== '' && point.lng !== '' && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)) && Math.abs(Number(point.lat)) <= 90 && Math.abs(Number(point.lng)) <= 180;

// Match the map's north-up Web Mercator geometry, including the date line.
export function projectRepresentation(points) {
    const valid = points.filter(validCoordinate);
    if (!valid.length) return [];
    const origin = Number(valid[0].lng);
    const projected = valid.map(point => {
        const longitude = origin + ((Number(point.lng) - origin + 540) % 360 - 180);
        const latitude = Math.max(-85.051129, Math.min(85.051129, Number(point.lat))) * Math.PI / 180;
        return { ...point, x: longitude * Math.PI / 180, y: -Math.log(Math.tan(Math.PI / 4 + latitude / 2)) };
    });
    const xs = projected.map(point => point.x), ys = projected.map(point => point.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
    const scale = Math.min(spanX > 0 ? 264 / spanX : Infinity, spanY > 0 ? 124 / spanY : Infinity);
    const fit = Number.isFinite(scale) ? scale : 1;
    return projected.map(point => ({ ...point, x: 160 + (point.x - centerX) * fit, y: 90 + (point.y - centerY) * fit }));
}

// Perspective transform from the image's 100×100 plane to its four map corners.
// CSS matrix3d preserves the entire image, rather than cropping it into a shape.
export function imageCornerTransform(corners) {
    if (corners.length !== 4) return null;
    const source = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const rows = source.flatMap(([u, v], i) => {
        const { x, y } = corners[i];
        return [[u, v, 1, 0, 0, 0, -x * u, -x * v, x], [0, 0, 0, u, v, 1, -y * u, -y * v, y]];
    });
    for (let column = 0; column < 8; column++) {
        let pivot = column;
        for (let row = column + 1; row < 8; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
        if (Math.abs(rows[pivot][column]) < 1e-10) return null;
        [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
        const divisor = rows[column][column];
        rows[column] = rows[column].map(value => value / divisor);
        for (let row = 0; row < 8; row++) {
            if (row === column) continue;
            const multiplier = rows[row][column];
            rows[row] = rows[row].map((value, i) => value - multiplier * rows[column][i]);
        }
    }
    const [a, b, c, d, e, f, g, h] = rows.map(row => row[8]);
    const matrix = [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1];
    return matrix.every(Number.isFinite) ? matrix : null;
}
