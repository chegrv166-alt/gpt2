#!/usr/bin/env python3
"""Pinned Godot setup, native checks, export and release packaging. Standard library only."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile

GODOT_VERSION = '4.6.3'
BASE = f'https://github.com/godotengine/godot-builds/releases/download/{GODOT_VERSION}-stable/'
PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parent

def digest(path: Path, algorithm: str = 'sha512') -> str:
    h = hashlib.new(algorithm)
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def host() -> str:
    if sys.platform == 'win32': return 'windows'
    if sys.platform.startswith('linux'): return 'linux'
    raise SystemExit('Release tooling supports Windows and Linux hosts')

def templates_dir() -> Path:
    base = Path(os.environ['APPDATA']) / 'Godot' if host() == 'windows' else Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share'))) / 'godot'
    return base / 'export_templates' / f'{GODOT_VERSION}.stable'

def engine_path(directory: Path) -> Path:
    name = f'Godot_v{GODOT_VERSION}-stable_win64_console.exe' if host() == 'windows' else f'Godot_v{GODOT_VERSION}-stable_linux.x86_64'
    return directory / name

def download(name: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    part = target.with_suffix(target.suffix + '.part')
    with urllib.request.urlopen(BASE + name, timeout=120) as response, part.open('wb') as output:
        shutil.copyfileobj(response, output, length=1024 * 1024)
    part.replace(target)

def bootstrap(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    binary = engine_path(directory)
    receipt = directory / 'verified-files.json'
    valid = False
    if receipt.exists():
        record = json.loads(receipt.read_text())
        valid = record.get('version') == GODOT_VERSION and binary.exists()
        valid = valid and all(Path(p).is_file() and digest(Path(p)) == expected for p, expected in record.get('files', {}).items())
        valid = valid and bool(record.get('files'))
    if not valid:
        downloads = directory.parent / ('godot-downloads-' + host())
        downloads.mkdir(parents=True, exist_ok=True)
        sums_file = downloads / 'SHA512-SUMS.txt'
        download('SHA512-SUMS.txt', sums_file)
        sums = {line.split()[-1].lstrip('*'): line.split()[0] for line in sums_file.read_text().splitlines() if len(line.split()) == 2}
        engine_archive = f'Godot_v{GODOT_VERSION}-stable_' + ('win64.exe.zip' if host() == 'windows' else 'linux.x86_64.zip')
        template_archive = f'Godot_v{GODOT_VERSION}-stable_export_templates.tpz'
        for name in [engine_archive, template_archive]:
            target = downloads / name
            if not target.exists() or digest(target) != sums[name]:
                download(name, target)
            if digest(target) != sums[name]: raise SystemExit(f'SHA512 mismatch: {name}')
            print(f'Official SHA512 verified: {name}', flush=True)
        files = []
        with zipfile.ZipFile(downloads / engine_archive) as z:
            for entry in z.infolist():
                path = Path(entry.filename)
                if path.is_absolute() or '..' in path.parts or '\\' in entry.filename: raise SystemExit('Unsafe engine archive path')
                target = directory / path
                if entry.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with z.open(entry) as src, target.open('wb') as dst: shutil.copyfileobj(src, dst)
                if host() == 'linux': target.chmod(0o755)
                files.append(target)
        target_dir = templates_dir()
        target_dir.mkdir(parents=True, exist_ok=True)
        names = ['windows_release_x86_64.exe', 'windows_release_x86_64_console.exe'] if host() == 'windows' else ['linux_release.x86_64']
        with zipfile.ZipFile(downloads / template_archive) as z:
            for name in names + ['version.txt']:
                target = target_dir / name
                with z.open('templates/' + name) as src, target.open('wb') as dst: shutil.copyfileobj(src, dst)
                if host() == 'linux' and name != 'version.txt': target.chmod(0o755)
                files.append(target)
        receipt.write_text(json.dumps({'version': GODOT_VERSION, 'source': BASE, 'files': {str(p): digest(p) for p in files}}, indent=2))
    if os.environ.get('GITHUB_ENV'):
        with open(os.environ['GITHUB_ENV'], 'a', encoding='utf-8') as f: f.write(f'GODOT_BIN={binary}\n')
    print(f'Godot executable: {binary}', flush=True)

def run(engine: Path, name: str, args: list[str], expected: str = '', timeout: int = 180) -> str:
    logs = PROJECT / 'build/validation'
    logs.mkdir(parents=True, exist_ok=True)
    path = logs / (name + '.log')
    path.unlink(missing_ok=True)
    process = subprocess.run([str(engine), '--log-file', str(path), *args], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
    output = path.read_text(encoding='utf-8', errors='replace') if path.exists() else process.stdout + process.stderr
    if process.returncode or re.search(r'SCRIPT ERROR|(?:^|\n)ERROR:', output) or (expected and expected not in output):
        print(output, flush=True)
        raise SystemExit(f'{name} failed (exit {process.returncode}, expected {expected!r})')
    print(f'{name}: passed', flush=True)
    return output

def check(engine: Path) -> None:
    run(engine, 'import', ['--headless', '--editor', '--path', str(PROJECT), '--import'])
    for suite, marker in [('run_tests', 'MODEL TESTS:'), ('art_checks', 'ART TESTS:'), ('scene_smoke', 'SCENE TESTS:'), ('visual_scene_checks', 'VISUAL SCENE TESTS:'), ('playthrough', 'PLAYTHROUGH TESTS:')]:
        output = run(engine, suite, ['--headless', '--path', str(PROJECT), '--script', 'tests/' + suite + '.gd'], marker, timeout=90)
        if not re.search(re.escape(marker) + r' \d+ checks, 0 failures', output): raise SystemExit(f'{suite} did not complete successfully')
        print(output.strip().splitlines()[-1], flush=True)

def native_binary() -> Path:
    return PROJECT / 'build' / host() / ('Ashen-Covenant-Chronicle.exe' if host() == 'windows' else 'Ashen-Covenant-Chronicle.x86_64')

def build(engine: Path) -> None:
    binary = native_binary()
    binary.parent.mkdir(parents=True, exist_ok=True)
    preset = 'Windows Desktop' if host() == 'windows' else 'Linux Desktop'
    run(engine, 'export', ['--headless', '--path', str(PROJECT), '--export-release', preset, str(binary)], timeout=300)
    if not binary.is_file() or binary.stat().st_size < 20_000_000: raise SystemExit('Native export missing or incomplete')
    if host() == 'linux': binary.chmod(0o755)
    with binary.open('rb') as f:
        if f.read(2 if host() == 'windows' else 4) != (b'MZ' if host() == 'windows' else b'\x7fELF'): raise SystemExit('Invalid native executable')
        f.seek(-4, 2)
        if f.read() != b'GDPC': raise SystemExit('Export must contain embedded game resources')

def smoke() -> None:
    output = run(native_binary(), 'packaged-' + host(), ['--headless', '--quit-after', '90'], 'CHRONICLE_READY', timeout=90)
    line = next(line.split('CHRONICLE_READY ', 1)[1] for line in output.splitlines() if 'CHRONICLE_READY ' in line)
    report = json.loads(line)
    expected_platform = 'Windows' if host() == 'windows' else 'Linux'
    if report.get('platform') != expected_platform or report.get('party') != 3 or report.get('locations') != 9 or not report.get('world_ready') or not report.get('hud_ready'):
        raise SystemExit(f'Packaged application did not initialize: {report}')
    print('Native packaged application readiness:', json.dumps(report, ensure_ascii=False), flush=True)

def package(version: str) -> None:
    if not re.fullmatch(r'\d+\.\d+\.\d+', version): raise SystemExit('Use a numeric release version')
    project_version = re.search(r'config/version="([^"]+)"', (PROJECT / 'project.godot').read_text(encoding='utf-8')).group(1)
    if project_version != version: raise SystemExit(f'Tag version {version} differs from project version {project_version}')
    binary = native_binary()
    artifacts = ROOT / 'release-godot'
    artifacts.mkdir(exist_ok=True)
    slug = 'Windows-x64' if host() == 'windows' else 'Linux-x86_64'
    base = f'Ashen-Covenant-{version}-{slug}'
    files = {binary.name: binary, 'README-RU.txt': PROJECT / 'PLAYER-RU.txt'}
    for name in ['Godot-LICENSE.txt', 'Godot-COPYRIGHT.txt', 'DejaVu-LICENSE.txt', 'PROVENANCE.md']:
        files['licenses/' + name] = PROJECT / 'assets' / name
    manifest = PROJECT / 'build' / ('manifest-' + host() + '.json')
    source = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    manifest.write_text(json.dumps({'version': version, 'godot': GODOT_VERSION, 'source_commit': source, 'platform': host(), 'executable_sha256': digest(binary, 'sha256')}, indent=2))
    files['build-manifest.json'] = manifest
    if host() == 'windows':
        archive = artifacts / (base + '.zip')
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for name, path in files.items(): z.write(path, name)
        with zipfile.ZipFile(archive) as z:
            if z.testzip() is not None: raise SystemExit('Release ZIP checksum failure')
    else:
        archive = artifacts / (base + '.tar.gz')
        with tarfile.open(archive, 'w:gz') as t:
            for name, path in files.items(): t.add(path, arcname=base + '/' + name)
        with tarfile.open(archive) as t:
            if not t.getmember(base + '/' + binary.name).mode & 0o111: raise SystemExit('Linux executable permission lost')
    print(f'Packaged {archive.name}: {archive.stat().st_size} bytes; SHA256 {digest(archive, "sha256")}', flush=True)

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['paths', 'bootstrap', 'check', 'build', 'smoke', 'package'])
    parser.add_argument('--directory', type=Path, default=Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'godot-runtime')
    parser.add_argument('--engine', type=Path, default=Path(os.environ.get('GODOT_BIN', shutil.which('godot') or 'godot')))
    parser.add_argument('--version', default='0.7.0')
    args = parser.parse_args()
    if args.command == 'paths':
        values = f'engine={args.directory}\ntemplates={templates_dir()}\n'
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as f: f.write(values)
        print(values)
    elif args.command == 'bootstrap': bootstrap(args.directory)
    elif args.command == 'check': check(args.engine)
    elif args.command == 'build': build(args.engine)
    elif args.command == 'smoke': smoke()
    elif args.command == 'package': package(args.version)

if __name__ == '__main__': main()
