#!/usr/bin/env python3
"""Copy approved stage-one original SVG assets from a checked-out Percy repo, unchanged.
Usage: python collect_icons_from_repo.py /path/to/positive_percy /path/to/output
"""
import argparse,json,shutil,pathlib
ap=argparse.ArgumentParser();ap.add_argument('repo');ap.add_argument('output'); args=ap.parse_args()
manifest=json.loads((pathlib.Path(__file__).with_name('approved-assets.manifest.json')).read_text())
root=pathlib.Path(args.repo); dst=pathlib.Path(args.output);dst.mkdir(parents=True,exist_ok=True)
ids=set()
for d in manifest['mappings'].values():
 for asset in d.values():ids.add(asset['asset_id'])
for cat in manifest['picker']['categories'].values():ids.update(cat['icons'])
for asset in manifest['todays_goals']['svg'].values():ids.add(asset['asset_id'])
for asset in manifest['illustrations'].values():ids.add(asset['asset_id'])
missing=[];n=0
for asset_id in sorted(ids):
 path=None
 parts=asset_id.split(':')
 if parts[0]=='phosphor':path=pathlib.Path('design/assets/phosphor')/parts[2]/(parts[1]+'.svg')
 if parts[0]=='streamline':path=pathlib.Path('design/assets/streamline')/pathlib.Path(*parts[1:]).with_suffix('.svg')
 if path is None:continue
 source=root/path
 if not source.exists():missing.append(str(path));continue
 target=dst/path;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target);n+=1
print(f'Copied {n} original SVG files; {len(missing)} missing')
for m in missing:print('MISSING',m)
if missing:raise SystemExit(1)
