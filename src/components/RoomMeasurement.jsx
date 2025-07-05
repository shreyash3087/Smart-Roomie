import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Ruler,
  Target,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Smartphone,
  Globe,
} from "lucide-react";
const ManualInput = ({
  manualMeasurements,
  setManualMeasurements,
  onSave,
  onCancel,
}) => (
  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">
      Manual Room Measurement
    </h3>
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Length (ft)
        </label>
        <input
          type="number"
          value={manualMeasurements.length}
          onChange={(e) =>
            setManualMeasurements((prev) => ({
              ...prev,
              length: e.target.value,
            }))
          }
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="0"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Width (ft)
        </label>
        <input
          type="number"
          value={manualMeasurements.width}
          onChange={(e) =>
            setManualMeasurements((prev) => ({
              ...prev,
              width: e.target.value,
            }))
          }
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="0"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Carpet Area (sq ft)
        </label>
        <input
          type="number"
          value={manualMeasurements.area}
          onChange={(e) =>
            setManualMeasurements((prev) => ({
              ...prev,
              area: e.target.value,
            }))
          }
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Enter area manually"
        />
      </div>
    </div>
    <div className="flex space-x-2">
      <button
        onClick={onSave}
        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
      >
        Save Measurements
      </button>
      <button
        onClick={onCancel}
        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
      >
        Cancel
      </button>
    </div>
  </div>
);
const RoomMeasurement = ({ listingData, setListingData, onNext, onBack }) => {
  const [supportStatus, setSupportStatus] = useState("checking");
  const [arSession, setArSession] = useState(null);
  const [measurements, setMeasurements] = useState({
    points: [],
    distances: [],
    roomDimensions: { length: 0, width: 0, area: 0 },
  });
  const [measurementStep, setMeasurementStep] = useState("start");
  const [instructions, setInstructions] = useState("");
  const canvasRef = useRef(null);
  const sessionRef = useRef(null);
  const glRef = useRef(null);
  const referenceSpaceRef = useRef(null);
  const hitTestSourceRef = useRef(null);
  const reticleRef = useRef(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualMeasurements, setManualMeasurements] = useState({
    length: "",
    width: "",
    area: "",
  });
  useEffect(() => {
    checkARSupport();
  }, []);

  const checkARSupport = async () => {
    try {
      if (!navigator.xr) {
        setSupportStatus("not-supported");
        return;
      }

      const isSupported = await navigator.xr.isSessionSupported("immersive-ar");
      if (isSupported) {
        setSupportStatus("supported");
      } else {
        setSupportStatus("not-supported");
      }
    } catch (error) {
      console.error("AR support check failed:", error);
      setSupportStatus("not-supported");
    }
  };

  const initializeGL = (session, gl) => {
    // Shader sources
    const vertexShaderSource = `
      attribute vec3 position;
      uniform mat4 projectionMatrix;
      uniform mat4 modelViewMatrix;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 10.0;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      uniform vec3 color;
      void main() {
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Create shader program
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // Create reticle geometry (simple circle)
    const reticleVertices = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      reticleVertices.push(Math.cos(angle) * 0.05, 0, Math.sin(angle) * 0.05);
    }

    const reticleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, reticleBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(reticleVertices),
      gl.STATIC_DRAW
    );

    return {
      program,
      reticleBuffer,
      reticleVertices: reticleVertices.length / 3,
    };
  };

  const startARSession = async () => {
    try {
      const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local", "hit-test"],
        optionalFeatures: ["dom-overlay", "light-estimation"],
      });

      sessionRef.current = session;
      setArSession(session);

      const canvas = canvasRef.current;
      const gl = canvas.getContext("webgl", { xrCompatible: true });
      glRef.current = gl;

      await gl.makeXRCompatible();

      const baseLayer = new XRWebGLLayer(session, gl);

      await session.updateRenderState({
        baseLayer: baseLayer,
      });

      const referenceSpace = await session.requestReferenceSpace("local");
      referenceSpaceRef.current = referenceSpace;

      // Initialize hit test source
      const hitTestSource = await session.requestHitTestSource({
        space: referenceSpace,
      });
      hitTestSourceRef.current = hitTestSource;

      // Initialize WebGL resources
      reticleRef.current = initializeGL(session, gl);

      setMeasurementStep("point1");
      setInstructions(
        "Move your device to scan for surfaces, then tap to place the first corner marker"
      );

      session.requestAnimationFrame(onXRFrame);
    } catch (error) {
      console.error("Failed to start AR session:", error);
      alert(
        "Failed to start AR session. Please ensure you have a compatible device and browser."
      );
    }
  };

  const onXRFrame = (time, frame) => {
    const session = sessionRef.current;
    if (!session) return;

    const gl = glRef.current;
    const referenceSpace = referenceSpaceRef.current;
    const hitTestSource = hitTestSourceRef.current;

    session.requestAnimationFrame(onXRFrame);

    // Get the pose of the device
    const pose = frame.getViewerPose(referenceSpace);
    if (!pose) return;

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    // Render for each eye
    for (const view of pose.views) {
      const viewport = session.renderState.baseLayer.getViewport(view);
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

      const projectionMatrix = view.projectionMatrix;
      const viewMatrix = view.transform.inverse.matrix;

      // Hit test for reticle placement
      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0];
          const hitPose = hit.getPose(referenceSpace);

          if (hitPose) {
            renderReticle(
              gl,
              reticleRef.current,
              projectionMatrix,
              viewMatrix,
              hitPose.transform.matrix
            );
          }
        }
      }

      // Render placed points
      measurements.points.forEach((point, index) => {
        renderPoint(
          gl,
          reticleRef.current,
          projectionMatrix,
          viewMatrix,
          point,
          index
        );
      });

      // Render lines between points
      renderLines(gl, reticleRef.current, projectionMatrix, viewMatrix);
    }
  };

  const renderReticle = (
    gl,
    resources,
    projectionMatrix,
    viewMatrix,
    transform
  ) => {
    const { program, reticleBuffer } = resources;

    gl.useProgram(program);

    // Set uniforms
    const projectionLocation = gl.getUniformLocation(
      program,
      "projectionMatrix"
    );
    const modelViewLocation = gl.getUniformLocation(program, "modelViewMatrix");
    const colorLocation = gl.getUniformLocation(program, "color");

    gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
    gl.uniformMatrix4fv(
      modelViewLocation,
      false,
      multiplyMatrices(viewMatrix, transform)
    );
    gl.uniform3f(colorLocation, 1.0, 1.0, 1.0); // White reticle

    // Bind geometry
    gl.bindBuffer(gl.ARRAY_BUFFER, reticleBuffer);
    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    // Draw
    gl.drawArrays(gl.LINE_LOOP, 0, resources.reticleVertices);
  };

  const renderPoint = (
    gl,
    resources,
    projectionMatrix,
    viewMatrix,
    point,
    index
  ) => {
    const { program } = resources;

    gl.useProgram(program);

    // Create transform matrix for point
    const pointTransform = [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      point.x,
      point.y,
      point.z,
      1,
    ];

    // Set uniforms
    const projectionLocation = gl.getUniformLocation(
      program,
      "projectionMatrix"
    );
    const modelViewLocation = gl.getUniformLocation(program, "modelViewMatrix");
    const colorLocation = gl.getUniformLocation(program, "color");

    gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
    gl.uniformMatrix4fv(
      modelViewLocation,
      false,
      multiplyMatrices(viewMatrix, pointTransform)
    );

    // Color based on point index
    const colors = [
      [1.0, 0.0, 0.0], // Red
      [0.0, 1.0, 0.0], // Green
      [0.0, 0.0, 1.0], // Blue
      [1.0, 1.0, 0.0], // Yellow
    ];
    const color = colors[index % colors.length];
    gl.uniform3f(colorLocation, color[0], color[1], color[2]);

    // Create point geometry
    const pointVertices = [0, 0, 0];
    const pointBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(pointVertices),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, 1);
  };

  const renderLines = (gl, resources, projectionMatrix, viewMatrix) => {
    if (measurements.points.length < 2) return;

    const { program } = resources;
    gl.useProgram(program);

    // Create line vertices
    const lineVertices = [];
    for (let i = 0; i < measurements.points.length; i++) {
      const point = measurements.points[i];
      lineVertices.push(point.x, point.y, point.z);

      if (i < measurements.points.length - 1) {
        const nextPoint = measurements.points[i + 1];
        lineVertices.push(nextPoint.x, nextPoint.y, nextPoint.z);
      }
    }

    // Close the loop if we have 4 points
    if (measurements.points.length === 4) {
      const firstPoint = measurements.points[0];
      lineVertices.push(firstPoint.x, firstPoint.y, firstPoint.z);
    }

    const lineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(lineVertices),
      gl.STATIC_DRAW
    );

    // Set uniforms
    const projectionLocation = gl.getUniformLocation(
      program,
      "projectionMatrix"
    );
    const modelViewLocation = gl.getUniformLocation(program, "modelViewMatrix");
    const colorLocation = gl.getUniformLocation(program, "color");

    const identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
    gl.uniformMatrix4fv(modelViewLocation, false, viewMatrix);
    gl.uniform3f(colorLocation, 1.0, 1.0, 0.0); // Yellow lines

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINES, 0, lineVertices.length / 3);
  };

  const multiplyMatrices = (a, b) => {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] =
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
    return result;
  };

  const handleScreenTap = async (event) => {
    if (!arSession || !measurementStep.startsWith("point")) return;

    try {
      const session = sessionRef.current;
      const referenceSpace = referenceSpaceRef.current;
      const hitTestSource = hitTestSourceRef.current;

      if (!session || !referenceSpace || !hitTestSource) return;

      // Get the latest frame
      const frame = await new Promise((resolve) => {
        session.requestAnimationFrame((time, frame) => resolve(frame));
      });

      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const hitPose = hit.getPose(referenceSpace);

        if (hitPose) {
          const newPoint = {
            x: hitPose.transform.position.x,
            y: hitPose.transform.position.y,
            z: hitPose.transform.position.z,
            id: measurements.points.length,
          };

          setMeasurements((prev) => ({
            ...prev,
            points: [...prev.points, newPoint],
          }));

          if (measurementStep === "point1") {
            setMeasurementStep("point2");
            setInstructions("Place the second corner marker");
          } else if (measurementStep === "point2") {
            setMeasurementStep("point3");
            setInstructions("Place the third corner marker");
          } else if (measurementStep === "point3") {
            setMeasurementStep("point4");
            setInstructions("Place the final corner marker");
          } else if (measurementStep === "point4") {
            calculateRoomDimensions();
            setMeasurementStep("complete");
            setInstructions("Room measurement complete!");
          }
        }
      }
    } catch (error) {
      console.error("Error placing point:", error);
    }
  };

  const calculateRoomDimensions = () => {
    const points = measurements.points;
    if (points.length < 4) return;

    const distances = [];
    for (let i = 0; i < 4; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % 4];

      const distance = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) +
          Math.pow(p2.y - p1.y, 2) +
          Math.pow(p2.z - p1.z, 2)
      );
      distances.push(distance);
    }

    const length = Math.max(distances[0], distances[2]);
    const width = Math.max(distances[1], distances[3]);
    const area = length * width;

    const metersToFeet = 3.28084;

    const roomData = {
      length: (length * metersToFeet).toFixed(1),
      width: (width * metersToFeet).toFixed(1),
      area: (area * metersToFeet * metersToFeet).toFixed(1),
    };

    setMeasurements((prev) => ({
      ...prev,
      distances,
      roomDimensions: roomData,
    }));

    setListingData((prev) => ({
      ...prev,
      roomSize: {
        length: parseFloat(roomData.length),
        width: parseFloat(roomData.width),
        area: parseFloat(roomData.area),
      },
    }));
  };

  const handleManualSave = () => {
    const length = parseFloat(manualMeasurements.length) || 0;
    const width = parseFloat(manualMeasurements.width) || 0;
    const area = parseFloat(manualMeasurements.area) || length * width;

    setListingData((prev) => ({
      ...prev,
      roomSize: { length, width, area },
    }));

    setShowManualInput(false);
    onNext();
  };

  const endARSession = () => {
    if (sessionRef.current) {
      sessionRef.current.end();
      sessionRef.current = null;
    }
    if (hitTestSourceRef.current) {
      hitTestSourceRef.current.cancel();
      hitTestSourceRef.current = null;
    }
    setArSession(null);
    setMeasurementStep("start");
    setMeasurements({
      points: [],
      distances: [],
      roomDimensions: { length: 0, width: 0, area: 0 },
    });
  };

  const SupportStatus = () => {
    if (supportStatus === "checking") {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking AR support...</p>
        </div>
      );
    }

    if (supportStatus === "not-supported") {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-amber-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-amber-800 mb-2">
                AR Not Supported
              </h3>
              <p className="text-amber-700 mb-4">
                Your device/browser doesn&apos;t support WebXR AR. This feature works
                on:
              </p>
              <ul className="text-sm text-amber-700 space-y-1 mb-4">
                <li className="flex items-center space-x-2">
                  <Smartphone className="w-4 h-4" />
                  <span>Android devices with Chrome 79+</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Globe className="w-4 h-4" />
                  <span>iOS devices with Mozilla WebXR Viewer app</span>
                </li>
              </ul>
              <p className="text-sm text-amber-600">
                Please try on a compatible device or use manual measurement
                instead.
              </p>
              <button
                onClick={() => setShowManualInput(true)}
                className="mt-4 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
              >
                Enter Measurements Manually
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const ARInterface = () => {
    if (!arSession) {
      return (
        <div className="text-center space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <Target className="w-12 h-12 text-orange-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-orange-800 mb-2">
              AR Room Measurement
            </h3>
            <p className="text-orange-700 mb-4">
              Use your camera to measure room dimensions accurately by placing
              markers at each corner.
            </p>
            <button
              onClick={startARSession}
              className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              Start AR Measurement
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">How it works:</h4>
            <ol className="text-sm text-gray-700 space-y-1 text-left">
              <li>1. Move your device to scan for surfaces</li>
              <li>
                2. When you see a white circle, tap to place a corner marker
              </li>
              <li>3. Repeat for each corner of the room</li>
              <li>4. The app will calculate dimensions automatically</li>
            </ol>
          </div>
        </div>
      );
    }

    return (
      <div className="relative">
        <canvas
          ref={canvasRef}
          onClick={handleScreenTap}
          className="w-full h-96 bg-black rounded-lg cursor-crosshair"
          style={{ aspectRatio: "16/9" }}
        />

        <div className="absolute top-4 left-4 right-4 bg-black bg-opacity-50 text-white p-3 rounded-lg">
          <p className="text-sm">{instructions}</p>
          <div className="mt-2 flex items-center space-x-2">
            <div className="flex space-x-1">
              {[1, 2, 3, 4].map((num) => (
                <div
                  key={num}
                  className={`w-3 h-3 rounded-full ${
                    measurements.points.length >= num
                      ? "bg-green-400"
                      : "bg-gray-400"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs">
              Points: {measurements.points.length}/4
            </span>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex justify-between">
          <button
            onClick={endARSession}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            End Session
          </button>

          {measurementStep === "complete" && (
            <button
              onClick={() => setMeasurementStep("results")}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              View Results
            </button>
          )}
        </div>
      </div>
    );
  };

  const Results = () => {
    const { roomDimensions } = measurements;

    if (measurementStep !== "results" && measurementStep !== "complete")
      return null;

    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-semibold text-green-800">
            Measurement Complete
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-green-700">Length</p>
            <p className="text-2xl font-bold text-green-900">
              {roomDimensions.length} ft
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-green-700">Width</p>
            <p className="text-2xl font-bold text-green-900">
              {roomDimensions.width} ft
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-green-700">Area</p>
            <p className="text-2xl font-bold text-green-900">
              {roomDimensions.area} sq ft
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-green-200">
          <p className="text-sm text-green-700">
            Points measured: {measurements.points.length}
          </p>
          <p className="text-xs text-green-600 mt-1">
            AR measurements are typically accurate within 1-2 inches
          </p>
        </div>

        <div className="mt-4 flex space-x-2">
          <button
            onClick={() => {
              setMeasurementStep("start");
              setMeasurements({
                points: [],
                distances: [],
                roomDimensions: { length: 0, width: 0, area: 0 },
              });
            }}
            className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
          >
            Measure Again
          </button>
          <button
            onClick={onNext}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {showManualInput && (
        <ManualInput
          manualMeasurements={manualMeasurements}
          setManualMeasurements={setManualMeasurements}
          onSave={handleManualSave}
          onCancel={() => setShowManualInput(false)}
        />
      )}
      {!showManualInput && (
        <>
          <div className="text-center">
            <Camera className="w-16 h-16 text-orange-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              AR Room Measurement
            </h2>
            <p className="text-gray-600">
              Use augmented reality to measure your room accurately
            </p>
          </div>

          <SupportStatus />

          {supportStatus === "supported" && (
            <>
              <ARInterface />
              <Results />
            </>
          )}

          {supportStatus === "not-supported" && (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                AR is not supported on this device. You can still use this as a
                reference for implementing AR measurement on compatible devices.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RoomMeasurement;
