"""Phase 1 generators: control (ros2_control), gazebo (Gazebo Harmonic) and navigation (Nav2 + slam_toolbox)."""

def test_phase1_packages_control_sim_navigation(registry, tmp_path):
    """Every example yields description + control + gazebo + navigation + bringup, all parseable, with one sensor per frame."""
    import py_compile
    import xml.etree.ElementTree as ET

    import yaml as _yaml

    from tesr_robot_builder.generators.pipeline import generate
    from tests.conftest import ROOT

    for ex in sorted((ROOT / "examples").glob("*.robot.yaml")):
        out = tmp_path / ex.stem
        res = generate(ex, out, registry=registry)
        assert res.report.ok, ex.name
        prefix = res.resolved.package_prefix
        for suffix in ("description", "control", "gazebo", "navigation", "bringup"):
            assert (out / "src" / f"{prefix}_{suffix}" / "package.xml").is_file(), (ex.name, suffix)
        for f in out.glob("src/*/launch/*.py"):
            py_compile.compile(str(f), doraise=True)
        for f in list(out.glob("src/*/config/*.yaml")) + list(out.glob("src/*/rviz/*.rviz")):
            _yaml.safe_load(f.read_text())
        ET.parse(out / "src" / f"{prefix}_gazebo" / "worlds" / "tesr_arena.sdf")
        nav = _yaml.safe_load((out / "src" / f"{prefix}_navigation" / "config" / "nav2_params.yaml").read_text())
        fp = nav["local_costmap"]["local_costmap"]["ros__parameters"]["footprint"]
        assert fp.startswith("[[") and nav["controller_server"]["ros__parameters"]["FollowPath"]["vx_max"] == res.resolved.definition.requirements.motion.v_max
        lidars = [h for h in res.resolved.hardware if h.category == "lidar"]
        sources = nav["local_costmap"]["local_costmap"]["ros__parameters"]["obstacle_layer"]["observation_sources"].split()
        assert len(sources) == len(lidars)
        gz = (out / "src" / f"{prefix}_description" / "urdf" / "gazebo.xacro").read_text()
        assert gz.count("<sensor ") == sum(1 for h in res.resolved.hardware if h.frame and h.category in ("lidar", "depth_camera", "rgb_camera", "imu"))
        ctrl = _yaml.safe_load((out / "src" / f"{prefix}_control" / "config" / "controllers.yaml").read_text())
        assert ctrl["controller_manager"]["ros__parameters"]["drive_controller"]["type"] == res.resolved.controller
