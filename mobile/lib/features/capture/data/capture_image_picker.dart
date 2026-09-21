import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:image_picker/image_picker.dart';

enum CaptureImageSource { camera, gallery }

abstract interface class CaptureImagePicker {
  Future<CaptureImageData?> pick(CaptureImageSource source);
  Future<CaptureImageData?> recoverLostImage();
}

class MobileCaptureImagePicker implements CaptureImagePicker {
  MobileCaptureImagePicker([ImagePicker? picker])
    : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<CaptureImageData?> pick(CaptureImageSource source) async {
    final XFile? file = await _picker.pickImage(
      source: source == CaptureImageSource.camera
          ? ImageSource.camera
          : ImageSource.gallery,
      imageQuality: 90,
    );
    return file == null ? null : _toImage(file);
  }

  @override
  Future<CaptureImageData?> recoverLostImage() async {
    final LostDataResponse lost = await _picker.retrieveLostData();
    if (lost.isEmpty || lost.files == null || lost.files!.isEmpty) return null;
    return _toImage(lost.files!.first);
  }

  Future<CaptureImageData> _toImage(XFile file) async {
    final String fileName = file.name;
    return CaptureImageData(
      bytes: await file.readAsBytes(),
      fileName: fileName,
      mimeType: _mimeType(file.mimeType, fileName),
    );
  }
}

String _mimeType(String? reported, String fileName) {
  if (reported == 'image/jpeg' ||
      reported == 'image/png' ||
      reported == 'image/webp') {
    return reported!;
  }
  final String lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
