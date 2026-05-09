import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_theme.dart';
import '../../core/providers/app_provider.dart';
import '../../core/widgets/app_shell.dart';

enum _HeroesFilter { ranking, nearby }

class HeroesPage extends StatefulWidget {
  const HeroesPage({super.key});

  @override
  State<HeroesPage> createState() => _HeroesPageState();
}

class _HeroesPageState extends State<HeroesPage> {
  _HeroesFilter _filter = _HeroesFilter.ranking;

  @override
  Widget build(BuildContext context) {
    final heroes = context.watch<AppProvider>().heroes;
    final rows = _filter == _HeroesFilter.ranking
        ? ([...heroes]..sort((a, b) => b.rescues.compareTo(a.rescues)))
        : ([...heroes]..sort((a, b) => a.distanceKm.compareTo(b.distanceKm)));

    return AppPage(
      child: ListView(
        padding: const EdgeInsets.only(top: 18, bottom: 24),
        children: [
          Row(
            children: [
              const Icon(
                Icons.workspace_premium_outlined,
                color: AppColors.warning,
                size: 24,
              ),
              const SizedBox(width: 8),
              Text('Heroes', style: AppTextStyles.h2.copyWith(fontSize: 28)),
              const Spacer(),
              const AppRoundIconButton(icon: Icons.shield_outlined),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Bang xep hang tinh nguyen vien va nhung nguoi co the ho tro quanh ban.',
            style: AppTextStyles.bodyLarge.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 18),
          if (rows.isNotEmpty)
            AppCard(
              child: Row(
                children: [
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: const BoxDecoration(
                          color: AppColors.primarySoft,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          rows.first.name.substring(0, 1).toUpperCase(),
                          style: AppTextStyles.h3.copyWith(
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      if (rows.first.verified)
                        Positioned(
                          right: -2,
                          bottom: -2,
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                            child: const Icon(
                              Icons.verified_outlined,
                              size: 14,
                              color: Color(0xFF3A7AFE),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(rows.first.name, style: AppTextStyles.title),
                        const SizedBox(height: 4),
                        Text(
                          '${rows.first.location} · ${rows.first.rescues} lan ho tro',
                          style: AppTextStyles.bodyStrong.copyWith(
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            size: 18,
                            color: AppColors.warning,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            rows.first.rating.toStringAsFixed(1),
                            style: AppTextStyles.title.copyWith(
                              color: AppColors.warning,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text('${rows.first.distanceKm} km', style: AppTextStyles.caption),
                    ],
                  ),
                ],
              ),
            ),
          const SizedBox(height: 18),
          AppSegmentedControl<_HeroesFilter>(
            value: _filter,
            items: const [
              AppSegmentItem(
                value: _HeroesFilter.ranking,
                label: 'Bang vang',
                icon: Icons.workspace_premium_outlined,
              ),
              AppSegmentItem(
                value: _HeroesFilter.nearby,
                label: 'Gan ban',
                icon: Icons.map_outlined,
              ),
            ],
            onChanged: (value) => setState(() => _filter = value),
          ),
          const SizedBox(height: 18),
          for (var index = 0; index < rows.length; index++) ...[
            _HeroListRow(hero: rows[index], rank: index + 1, nearby: _filter == _HeroesFilter.nearby),
            const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }
}

class _HeroListRow extends StatelessWidget {
  const _HeroListRow({
    required this.hero,
    required this.rank,
    required this.nearby,
  });

  final HeroProfile hero;
  final int rank;
  final bool nearby;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: rank == 1 ? const Color(0xFFFFF1D7) : AppColors.accent,
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: Text(
              '$rank',
              style: AppTextStyles.title.copyWith(
                color: rank == 1 ? AppColors.warning : AppColors.textPrimary,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        hero.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.title,
                      ),
                    ),
                    if (hero.verified) ...[
                      const SizedBox(width: 6),
                      const Icon(
                        Icons.verified_outlined,
                        size: 16,
                        color: Color(0xFF3A7AFE),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  nearby
                      ? 'Cach ban ${hero.distanceKm.toStringAsFixed(1)} km'
                      : '${hero.location} · ${hero.rescues} lan cuu',
                  style: AppTextStyles.body.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Row(
            children: [
              const Icon(
                Icons.star_rounded,
                color: AppColors.warning,
                size: 18,
              ),
              const SizedBox(width: 4),
              Text(
                hero.rating.toStringAsFixed(1),
                style: AppTextStyles.title.copyWith(color: AppColors.warning),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
