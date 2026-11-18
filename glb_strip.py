# Reduce un GLB a las animaciones indicadas, compactando el binario.
import json, struct, sys
def strip(src, dst, keep):
    b = open(src, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl])
    bin_off = 20 + jl + 8; binc = b[bin_off:bin_off + struct.unpack('<I', b[20 + jl:24 + jl])[0]]
    j['animations'] = [a for a in j.get('animations', []) if a['name'] in keep]
    used = set()
    for m in j.get('meshes', []):
        for p in m['primitives']:
            used.update(p['attributes'].values())
            if 'indices' in p: used.add(p['indices'])
            for t in p.get('targets', []): used.update(t.values())
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: used.add(s['inverseBindMatrices'])
    for a in j['animations']:
        for s in a['samplers']: used.update([s['input'], s['output']])
    acc_map = {}; new_acc = []
    for i, a in enumerate(j['accessors']):
        if i in used: acc_map[i] = len(new_acc); new_acc.append(a)
    bv_used = sorted({a['bufferView'] for a in new_acc if 'bufferView' in a} | {im['bufferView'] for im in j.get('images', []) if 'bufferView' in im})
    out = bytearray(); bv_map = {}; new_bv = []
    for i in bv_used:
        v = dict(j['bufferViews'][i]); data = binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
        while len(out) % 4: out.append(0)
        v['byteOffset'] = len(out); out += data; bv_map[i] = len(new_bv); new_bv.append(v)
    while len(out) % 4: out.append(0)
    for a in new_acc:
        if 'bufferView' in a: a['bufferView'] = bv_map[a['bufferView']]
    for im in j.get('images', []):
        if 'bufferView' in im: im['bufferView'] = bv_map[im['bufferView']]
    for m in j.get('meshes', []):
        for p in m['primitives']:
            p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
            if 'indices' in p: p['indices'] = acc_map[p['indices']]
            if 'targets' in p: p['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in p['targets']]
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = acc_map[s['inverseBindMatrices']]
    for a in j['animations']:
        for s in a['samplers']: s['input'] = acc_map[s['input']]; s['output'] = acc_map[s['output']]
    j['accessors'] = new_acc; j['bufferViews'] = new_bv; j['buffers'] = [{'byteLength': len(out)}]
    js = json.dumps(j, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total)); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
if __name__ == '__main__':
    keep = set(sys.argv[3].split(','))
    strip(sys.argv[1], sys.argv[2], keep)
