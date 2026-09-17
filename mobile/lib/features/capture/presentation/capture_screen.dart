import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:bowlingmanager_mobile/core/theme/app_text_styles.dart';
import 'package:flutter/material.dart';

class CaptureScreen extends StatelessWidget {
  const CaptureScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const Text('점수판 촬영', style: AppTextStyles.headline),
          const SizedBox(height: 6),
          const Text(
            '점수 입력을 더 빠르고 간편하게',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const Spacer(),
          Center(
            child: Container(
              width: 144,
              height: 144,
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.divider),
              ),
              child: const Icon(
                Icons.document_scanner_outlined,
                size: 64,
                color: AppColors.primaryBright,
              ),
            ),
          ),
          const SizedBox(height: 30),
          const Text(
            '점수판을 촬영하면 AI가\n자동으로 점수를 인식합니다.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 19,
              fontWeight: FontWeight.w700,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            '카메라와 OCR 기능은 추후 업데이트에서 제공됩니다.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const Spacer(),
          FilledButton.icon(
            onPressed: null,
            icon: const Icon(Icons.camera_alt_outlined),
            label: const Text('카메라로 촬영'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: null,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            icon: const Icon(Icons.photo_library_outlined),
            label: const Text('갤러리에서 선택'),
          ),
        ],
      ),
    );
  }
}
