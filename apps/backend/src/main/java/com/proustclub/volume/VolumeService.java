package com.proustclub.volume;

import com.proustclub.volume.dto.VolumeResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class VolumeService {

    private final VolumeRepository repository;

    VolumeService(VolumeRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<VolumeResponse> list() {
        return repository.findAll().stream()
                .map(volume -> new VolumeResponse(
                        volume.id(), volume.title(), volume.position(), volume.minPage(), volume.maxPage()))
                .toList();
    }
}
