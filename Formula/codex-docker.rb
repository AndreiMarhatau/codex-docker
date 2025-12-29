class CodexDocker < Formula
  desc "Run Codex CLI in a disposable Docker container"
  homepage "https://github.com/AndreiMarhatau/codex-docker"
  url "https://github.com/AndreiMarhatau/codex-docker/archive/refs/tags/v0.0.7.tar.gz"
  sha256 "d626db6608816f2153c9ca27c5a0d5ed0dea69f385b1aaab5696bbd07fc806f2"
  license "MIT"

  depends_on "docker"

  livecheck do
    url :stable
    strategy :github_latest
  end

  def install
    bin.install "codex-docker"
  end

  test do
    assert_match "codex-docker", (bin/"codex-docker").read
  end
end
