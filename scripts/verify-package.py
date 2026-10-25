"""Verify the actual packed artifact without extracting or executing its contents."""
import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile

package = Path(sys.argv[1])
allowed = {'LICENSE', 'README.md', 'MIGRATION.md', 'THIRD_PARTY_NOTICES.md', 'package.json'}
patterns = [re.compile(pattern) for pattern in [
    rb'gh[pousr]_[A-Za-z0-9]{20,}', rb'github_pat_[A-Za-z0-9_]{20,}',
    rb'npm_[A-Za-z0-9]{20,}', rb'AKIA[A-Z0-9]{16}',
    rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    rb'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',
]]
entries = []
with tarfile.open(package) as archive:
    for item in archive.getmembers():
        if not item.isfile() or not item.name.startswith('package/') or '..' in Path(item.name).parts:
            raise ValueError('Unsafe archive member; content suppressed')
        path = item.name[8:]
        if not (path.startswith('dist/') or path in allowed):
            raise ValueError('Unexpected package member; content suppressed')
        data = archive.extractfile(item).read()
        if any(pattern.search(data) for pattern in patterns):
            raise ValueError('Potential credential pattern detected; content suppressed')
        entries.append({'path': path, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    manifest = json.load(archive.extractfile('package/package.json'))
    if manifest['name'] != '@spexop/theme' or manifest['version'] != '0.7.0-alpha.0' or manifest['private'] is not True:
        raise ValueError('Unexpected package identity or publication safety flag')
    names = {entry['path'] for entry in entries}
    if not allowed.issubset(names) or not {'dist/index.js', 'dist/index.d.ts'}.issubset(names):
        raise ValueError('Missing entry points or license/documentation files')
    if manifest['dependencies'] != {'colorjs.io': '0.7.1'}:
        raise ValueError('Runtime dependency graph changed; review required')
print(json.dumps({
    'tarball': package.name, 'sha256': hashlib.sha256(package.read_bytes()).hexdigest(),
    'files': len(entries), 'bytes': package.stat().st_size, 'private': True,
    'secretPatternMatches': 0, 'scanLimit': 'Pattern-based artifact scan, not historical credential revocation evidence',
    'entries': entries,
}, indent=2))
