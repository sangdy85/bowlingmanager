import 'package:flutter/material.dart';

const Color bowlingGold = Color(0xFFFFC857);
const Color bowlingSilver = Color(0xFFC6D0DC);
const Color bowlingBronze = Color(0xFFCD7F4A);

Color? bowlingMedalColor(int position) => switch (position) {
  1 => bowlingGold,
  2 => bowlingSilver,
  3 => bowlingBronze,
  _ => null,
};

class BowlingMedalIcon extends StatelessWidget {
  const BowlingMedalIcon({required this.position, this.size = 25, super.key});

  final int position;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Icon(
      Icons.military_tech_rounded,
      color: bowlingMedalColor(position),
      size: size,
    );
  }
}
