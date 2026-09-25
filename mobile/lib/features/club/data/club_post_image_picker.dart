import 'package:bowlingmanager_mobile/features/capture/domain/capture_models.dart';
import 'package:image_picker/image_picker.dart';

abstract interface class ClubPostImagePicker {
  Future<List<CaptureImageData>> pickImages();
}

class MobileClubPostImagePicker implements ClubPostImagePicker {
  MobileClubPostImagePicker([ImagePicker? picker])
    : _picker = picker ?? ImagePicker();
  final ImagePicker _picker;

  @override
  Future<List<CaptureImageData>> pickImages() async {
    final files = await _picker.pickMultiImage(imageQuality: 90);
    return Future.wait(
      files.map((file) async {
        final name = file.name;
        return CaptureImageData(
          bytes: await file.readAsBytes(),
          fileName: name,
          mimeType: _mimeType(file.mimeType, name),
        );
      }),
    );
  }
}

String _mimeType(String? reported, String fileName) {
  if (reported == 'image/jpeg' ||
      reported == 'image/png' ||
      reported == 'image/webp') {
    return reported!;
  }
  final lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}
