package com.proustclub.volume;

import java.util.List;

record VolumeData(int id, String title, int position, int minPage, int maxPage, List<PartData> parts) {}

record PartData(int id, String title, int position, int startPage) {}
