import 'package:bowlingmanager_mobile/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

abstract final class AppTextStyles {
  static const TextStyle displayScore = TextStyle(
    color: AppColors.textPrimary,
    fontSize: 48,
    height: 1,
    fontWeight: FontWeight.w800,
    letterSpacing: -1.5,
  );

  static const TextStyle headline = TextStyle(
    color: AppColors.textPrimary,
    fontSize: 24,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle title = TextStyle(
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle body = TextStyle(
    color: AppColors.textPrimary,
    fontSize: 15,
    height: 1.5,
  );

  static const TextStyle label = TextStyle(
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.8,
  );
}
