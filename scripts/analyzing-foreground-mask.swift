// macOS 14+ Vision segmentation runs locally; no frame leaves the machine.
import Vision
import Foundation
import CoreImage

guard CommandLine.arguments.count == 3 else {
  fatalError("Usage: swift analyzing-foreground-mask.swift frames-directory masks-directory")
}
let source = URL(fileURLWithPath: CommandLine.arguments[1])
let destination = URL(fileURLWithPath: CommandLine.arguments[2])
let context = CIContext()
let files = try FileManager.default.contentsOfDirectory(
  at: source, includingPropertiesForKeys: nil
).filter { $0.pathExtension == "png" }
 .sorted { $0.lastPathComponent < $1.lastPathComponent }

for (index, file) in files.enumerated() {
  try autoreleasepool {
    let handler = VNImageRequestHandler(url: file, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    try handler.perform([request])
    guard let result = request.results?.first, !result.allInstances.isEmpty else {
      throw NSError(domain: "ForegroundMaskMissing", code: index)
    }
    let mask = try result.generateScaledMaskForImage(
      forInstances: result.allInstances, from: handler
    )
    try context.writePNGRepresentation(
      of: CIImage(cvPixelBuffer: mask),
      to: destination.appendingPathComponent(file.lastPathComponent),
      format: .L8, colorSpace: CGColorSpaceCreateDeviceGray()
    )
  }
  if index % 24 == 0 { print("Segmented frame \(index + 1)/\(files.count)") }
}
