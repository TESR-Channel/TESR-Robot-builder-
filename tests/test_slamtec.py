"""Slamtec S3 / C1 (TESR focus LiDARs): real sample counts in Gazebo, drivers.repos, custom world in the one-command launch."""


def _robot_with(tmp_path, registry, lidar_hw: str):
    from tesr_robot_builder.generators.pipeline import generate
    from tests.conftest import ROOT

    src = (ROOT / "examples" / "mecanum_demo.robot.yaml").read_text().replace("hw: rplidar_s2", f"hw: {lidar_hw}")
    yml = tmp_path / f"{lidar_hw}.robot.yaml"
    yml.write_text(src)
    out = tmp_path / lidar_hw
    res = generate(yml, out, registry=registry)
    assert res.report.ok
    return res, out


def test_registry_has_focus_lidars(registry):
    for hw, rng, sr in (("slamtec_s3", 40, 32000), ("slamtec_c1", 12, 5000)):
        rec = registry.hardware[hw]
        assert rec.category == "lidar" and rec.sensor.range_m == rng and rec.sensor.sample_rate_hz == sr
        assert abs(rec.dims_m[2] - 0.0413) < 1e-6


def test_lidar_samples_follow_the_datasheet():
    from tesr_robot_builder.generators.plan import SIM_MAX_SAMPLES, lidar_samples
    assert lidar_samples(5000, 10, 360) == 500           # C1 at 10 Hz
    assert lidar_samples(32000, 10, 360) == SIM_MAX_SAMPLES  # S3 capped to keep Gazebo light
    assert lidar_samples(None, 10, 270) == 540             # no sampling rate: 2 rays per degree


def test_c1_workspace_has_repos_world_arg_and_500_rays(registry, tmp_path):
    res, out = _robot_with(tmp_path, registry, "slamtec_c1")
    prefix = res.resolved.package_prefix
    repos = (out / "drivers.repos").read_text()
    assert "sllidar_ros2" in repos and "github.com/Slamtec/sllidar_ros2" in repos
    gz = (out / "src" / f"{prefix}_description" / "urdf" / "gazebo.xacro").read_text()
    assert "<samples>500</samples>" in gz
    sim = (out / "src" / f"{prefix}_bringup" / "launch" / "sim.launch.py").read_text()
    for arg in ("'world'", "'x'", "'y'", "'yaw'"):
        assert f"DeclareLaunchArgument({arg}" in sim
    readme = (out / "src" / f"{prefix}_bringup" / "README.md").read_text()
    assert "vcs import src < drivers.repos" in readme and "sllidar_c1_launch.py" in readme


def test_apt_only_robot_has_no_repos_file(registry, tmp_path):
    _, out = _robot_with(tmp_path, registry, "rplidar_s2")
    assert not (out / "drivers.repos").exists()
