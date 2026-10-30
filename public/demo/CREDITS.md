# Odin demo footage

These clips are edited, silent 960 × 540 excerpts of the stock footage below, used inside Odin's camera-monitoring demonstration. They are not footage from real Odin installations. Thumbnails are frames extracted from the corresponding edited clips.

The footage is used under the [Pexels License](https://www.pexels.com/license/). The original photographers and people shown do not endorse Odin. The footage is not covered by any license applied to Odin's source code.

| Local file | Creator | Original footage |
| --- | --- | --- |
| `warehouse-v2.mp4` | Tiger Lily | [Men Working in the Warehouse](https://www.pexels.com/video/men-working-in-the-warehouse-4293958/) |
| `mall-v2.mp4` | George Morina | [High Angle View of a Crowded Shopping Mall](https://www.pexels.com/video/high-angle-view-of-a-crowded-shopping-mall-15007111/) |
| `park-v2.mp4` | 宋 小天 | [People Walking in the Park](https://www.pexels.com/video/people-walking-in-the-park-4359494/) |
| `retail-v2.mp4` | Aamir Somewhere | [Woman Shopping in a Modern Supermarket](https://www.pexels.com/video/woman-shopping-in-a-modern-supermarket-29846460/) |
| `traffic-v2.mp4` | Ivan Chumak | [Daily Traffic at Busy Urban Intersection](https://www.pexels.com/video/daily-traffic-at-busy-urban-intersection-36902792/) |
| `factory-v2.mp4` | K | [Man using machinery in factory](https://www.pexels.com/video/man-using-machinery-in-factory-9737949/) |

## Recorded overlays

`detections-v2.json` contains precomputed MobileNet-SSD object detections from these edited clips, sampled every five frames at 24 FPS. The dense mall scene uses four additional overlapping crop passes. Boxes between adjacent samples are interpolated for the same camera-local track. Missing detections remain missing; the overlays are illustrative model output and do not establish accuracy, complete coverage, or identity. Track numbers are local associations, not people's names.

The separately scripted event descriptions in `lib/demo.ts` summarize visible activity. Playback does not run live inference, call Gemini, or send workflow actions.

Regenerate detections using Python with `opencv-python-headless<5` and the [MobileNet-SSD model files](https://github.com/chuanqi305/MobileNet-SSD) (`deploy.prototxt` and `mobilenet_iter_73000.caffemodel`):

```sh
python scripts/prepare-demo-annotations.py /path/to/deploy.prototxt /path/to/mobilenet_iter_73000.caffemodel
```

Model files are build-time tools and are not bundled with the application. Real camera monitoring continues to use Odin's existing browser detector.
