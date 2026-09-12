# tesr-robot-registry (embedded, Phase 0)

Data, not code. Three sets, linked by id — see `docs/adr/0003-registry-as-data.md`.

| Folder | Content | Consumer |
|---|---|---|
| `hardware/<category>/<id>.yaml` | engineering data: mass, dims, electrical, interfaces, sensor/compute specs | resolver, rules, calculators |
| `drivers/<hw_id>/<distro>/manifest.yaml` | ROS driver profile (package, apt/pip, node, topics, frame, ros2_control plugin) | generators, rules |
| `profiles/drive/*.yaml`, `profiles/nav/*.yaml` | kinematics/controller defaults and Nav2 sizing parameters | resolver |

`verified: false` marks records whose numbers still have to be checked against a datasheet or a TESR Shop SKU.
Add a part by adding a file; `tesr-rb registry` lists what is loaded. This folder becomes the public
`tesr-robot-registry` repository once the generator is proven (Phase 1 gate).
