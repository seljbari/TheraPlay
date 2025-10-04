export async function mountWebcam(containerId, { onFrame } = {}) {
  const host = document.getElementById(containerId);

  host.innerHTML = `
    <div class="videoView">
      <button id="webcamButton">ENABLE WEBCAM</button>
      <div class="videoShell">
        <video id="webcam" autoplay playsinline muted></video>
        <canvas id="output_canvas"></canvas>
      </div>
    </div>
  `;

  const btn = host.querySelector('#webcamButton');
  const video = host.querySelector('#webcam');
  const canvas = host.querySelector('#output_canvas');
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = host.clientWidth;
    canvas.height = host.clientHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  let rafId;
  function loop() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (typeof onFrame === 'function') {
      onFrame({ video, ctx, canvas });
    }
    rafId = requestAnimationFrame(loop);
  }

  async function enableCam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();
      loop();
    } catch (err) {
      alert("Webcam access error: " + err);
    }
  }

  btn.addEventListener('click', enableCam);

  return {
    stop() {
      cancelAnimationFrame(rafId);
      video.srcObject?.getTracks().forEach(t => t.stop());
    }
  };
}
