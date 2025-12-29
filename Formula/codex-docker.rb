class CodexDocker < Formula
  desc "Run Codex CLI in a disposable Docker container"
  homepage "https://github.com/AndreiMarhatau/codex-docker"
  url "https://github.com/AndreiMarhatau/codex-docker/archive/775156acd4f7a2e301f7b63e3266601832fd8eca.tar.gz"
  sha256 "20394a9e8f55281c28d95c33f7e6e2f737cc59839b2496d8ff5a45a4c4be536d"
  license "MIT"

  depends_on "docker"

  def install
    bin.install "codex-docker"
  end

  test do
    assert_match "codex-docker", (bin/"codex-docker").read
  end
end
